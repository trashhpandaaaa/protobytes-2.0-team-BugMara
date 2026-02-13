"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Map, { Marker, Popup, NavigationControl, Source, Layer } from "react-map-gl/mapbox";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import {
  MapPin,
  Navigation,
  Navigation2,
  X,
  Locate,
  Volume2,
  VolumeX,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  ArrowUpLeft,
  ArrowUpRight,
  RotateCcw,
  MoveUp,
  Flag,
  Clock,
  Gauge,
} from "lucide-react";
import Link from "next/link";
import type { IStation } from "@/types";
import { getConnectorLabel, haversineDistance } from "@/lib/utils";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapRef } from "react-map-gl/mapbox";
import type { RouteData, RouteStep } from "@/components/station/RoutePlanner";

/* ═══════════════════════════════════════════════════════════
   Mercator helpers – avoids direct mapbox-gl import for SSR
   ═══════════════════════════════════════════════════════════ */
function lngToMercX(lng: number) {
  return (180 + lng) / 360;
}
function latToMercY(lat: number) {
  return (
    (180 -
      (180 / Math.PI) *
        Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) /
    360
  );
}
/** Mercator-coordinate-units that equal 1 real-world metre at `lat`. */
function meterScale(lat: number) {
  return 1 / (2 * Math.PI * 6378137 * Math.cos((lat * Math.PI) / 180));
}

/** Calculate bearing from point A to point B in degrees (0=north, CW) */
function calcBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180;
  const dLng = (lng2 - lng1) * toRad;
  const y = Math.sin(dLng) * Math.cos(lat2 * toRad);
  const x =
    Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
    Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Find closest point on polyline to user, return { index, fraction, distKm } */
function findClosestOnRoute(
  lat: number,
  lng: number,
  coords: [number, number][]
): { segIndex: number; fraction: number; distKm: number } {
  let bestDist = Infinity;
  let bestSeg = 0;
  let bestFrac = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = coords[i];     // lng, lat
    const [bx, by] = coords[i + 1];
    // project point onto segment
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((lng - ax) * dx + (lat - ay) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));

    const projLng = ax + t * dx;
    const projLat = ay + t * dy;
    const d = haversineDistance(lat, lng, projLat, projLng);
    if (d < bestDist) {
      bestDist = d;
      bestSeg = i;
      bestFrac = t;
    }
  }
  return { segIndex: bestSeg, fraction: bestFrac, distKm: bestDist };
}

/** Sum distance along route from a segment/fraction to the end */
function distanceAlongRouteRemaining(
  coords: [number, number][],
  segIndex: number,
  fraction: number
): number {
  // distance from projection point to end of current segment
  const [ax, ay] = coords[segIndex];
  const [bx, by] = coords[segIndex + 1];
  const projLng = ax + fraction * (bx - ax);
  const projLat = ay + fraction * (by - ay);
  let total = haversineDistance(projLat, projLng, by, bx); // km

  // remaining full segments
  for (let i = segIndex + 1; i < coords.length - 1; i++) {
    total += haversineDistance(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]);
  }
  return total; // km
}

/* ═══════════════════════════════════════════════════════════
   Maneuver icon mapping
   ═══════════════════════════════════════════════════════════ */
function ManeuverIcon({ type, modifier }: { type: string; modifier?: string }) {
  const cls = "h-6 w-6 text-white";
  if (type === "arrive") return <Flag className={cls} />;
  if (type === "depart") return <MoveUp className={cls} />;
  if (modifier?.includes("left") && modifier.includes("slight"))
    return <ArrowUpLeft className={cls} />;
  if (modifier?.includes("right") && modifier.includes("slight"))
    return <ArrowUpRight className={cls} />;
  if (modifier?.includes("left")) return <CornerUpLeft className={cls} />;
  if (modifier?.includes("right")) return <CornerUpRight className={cls} />;
  if (modifier?.includes("uturn")) return <RotateCcw className={cls} />;
  return <ArrowUp className={cls} />;
}

/* ═══════════════════════════════════════════════════════════ */

interface StationMapProps {
  stations: IStation[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  interactive?: boolean;
  routeData?: RouteData | null;
  highlightedStationIds?: Set<string>;
  userLocation?: { lat: number; lng: number } | null;
  userHeading?: number | null;       // bearing 0-360
  userSpeed?: number | null;         // m/s
  navigationMode?: boolean;
  onToggleNavigation?: () => void;
}

export function StationMap({
  stations,
  center = { lat: 28.3949, lng: 84.124 },
  zoom = 7,
  className = "h-[500px] w-full",
  interactive = true,
  routeData,
  highlightedStationIds,
  userLocation,
  userHeading = null,
  userSpeed = null,
  navigationMode = false,
  onToggleNavigation,
}: StationMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [selectedStation, setSelectedStation] = useState<IStation | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Refs for real-time car updates (avoid recreating Three.js scene)
  const carModelRef = useRef<THREE.Object3D | null>(null);
  const sceneRefData = useRef<{
    refX: number; refY: number; scale: number;
  } | null>(null);
  const mapObjRef = useRef<any>(null);

  // Navigation state
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [distRemaining, setDistRemaining] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [followCamera, setFollowCamera] = useState(true);
  const userInteractedRef = useRef(false);
  const hasFlownToUserRef = useRef(false);
  const lastFittedRouteRef = useRef<string | null>(null);

  // Stable primitive values for dependency arrays (avoid object-reference churn)
  const centerLat = center.lat;
  const centerLng = center.lng;

  /* ─── Click on map → find nearest station to open popup ─── */
  const handleMapClick = useCallback(
    (e: any) => {
      const clickLng = e.lngLat.lng;
      const clickLat = e.lngLat.lat;
      const map = mapRef.current?.getMap();
      if (!map) return;

      const clickPoint = map.project([clickLng, clickLat]);
      let closest: IStation | null = null;
      let closestDist = Infinity;

      for (const station of stations) {
        const lat = station.location?.coordinates?.lat ?? 0;
        const lng = station.location?.coordinates?.lng ?? 0;
        if (!lat || !lng) continue;

        const stationPoint = map.project([lng, lat]);
        const dx = clickPoint.x - stationPoint.x;
        const dy = clickPoint.y - stationPoint.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < closestDist) {
          closestDist = dist;
          closest = station;
        }
      }

      if (closest && closestDist < 40) {
        setSelectedStation(closest);
      } else {
        setSelectedStation(null);
      }

      // If user taps map in nav mode, pause follow camera
      if (navigationMode) userInteractedRef.current = true;
    },
    [stations, navigationMode]
  );

  /* ─── Configure Mapbox Standard dark/dusk 3D look ─── */
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current.getMap();

    try {
      map.setConfigProperty("basemap", "lightPreset", "dusk");
      map.setConfigProperty("basemap", "show3dObjects", true);
    } catch { /* */ }
  }, [mapLoaded]);

  /* ─── Three.js custom layer for 3D GLB models ─── */
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current.getMap();
    mapObjRef.current = map;

    const validStations = stations.filter(
      (s) => s.location?.coordinates?.lat && s.location?.coordinates?.lng
    );
    if (validStations.length === 0 && !userLocation) return;

    const refLat = centerLat;
    const refLng = centerLng;
    const refX = lngToMercX(refLng);
    const refY = latToMercY(refLat);
    const scale = meterScale(refLat);
    sceneRefData.current = { refX, refY, scale };

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    let renderer: THREE.WebGLRenderer;

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(100, 200, 300);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
    fill.position.set(-100, -50, 100);
    scene.add(fill);
    const accent = new THREE.PointLight(0x60a5fa, 0.8, 800);
    accent.position.set(0, 0, 100);
    scene.add(accent);

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
    loader.setDRACOLoader(dracoLoader);

    const allModels: THREE.Object3D[] = [];
    let disposed = false;

    // ── Station GLB ──
    const STATION_SCALE = 5;
    loader.load("/models/electric_charging_station.glb", (gltf) => {
      if (disposed) return;
      const template = gltf.scene;
      template.rotation.set(Math.PI / 2, -Math.PI / 6, 0);

      validStations.forEach((station, i) => {
        const { lng, lat } = station.location.coordinates;
        const dx = (lngToMercX(lng) - refX) / scale;
        const dy = (refY - latToMercY(lat)) / scale;
        const model = template.clone();
        model.scale.set(STATION_SCALE, STATION_SCALE, STATION_SCALE);
        model.position.set(dx, dy, 0);
        model.userData = { idx: i, type: "station", baseScale: STATION_SCALE };
        scene.add(model);
        allModels.push(model);
      });
      map.triggerRepaint();
    }, undefined, (err) => console.error("[StationMap] Station GLB error:", err));

    // ── Car GLB (always load, show when userLocation exists) ──
    const CAR_SCALE = 300;
    loader.load("/models/car_mg4.glb", (gltf) => {
      if (disposed) return;
      const car = gltf.scene;
      car.rotation.set(Math.PI / 2, 0, 0);
      car.scale.set(CAR_SCALE, CAR_SCALE, CAR_SCALE);
      car.userData = { type: "car", baseScale: CAR_SCALE, heading: 0 };

      if (userLocation) {
        const dx = (lngToMercX(userLocation.lng) - refX) / scale;
        const dy = (refY - latToMercY(userLocation.lat)) / scale;
        car.position.set(dx, dy, 0);
        car.visible = true;
      } else {
        car.visible = false;
      }

      carModelRef.current = car;
      scene.add(car);
      allModels.push(car);
      map.triggerRepaint();
    }, undefined, (err) => console.error("[StationMap] Car GLB error:", err));

    const LAYER_ID = "ev-3d-models";

    const customLayer = {
      id: LAYER_ID,
      type: "custom" as const,
      renderingMode: "3d" as const,

      onAdd(_map: any, gl: WebGLRenderingContext) {
        renderer = new THREE.WebGLRenderer({
          canvas: _map.getCanvas(),
          context: gl,
          antialias: true,
        });
        renderer.autoClear = false;
      },

      render(_gl: WebGLRenderingContext, matrix: number[]) {
        const t = performance.now() * 0.001;
        const currentZoom = map.getZoom();
        const zoomFactor = Math.pow(2, 15 - currentZoom);

        allModels.forEach((m, i) => {
          const base = m.userData?.baseScale ?? 30;
          const s = base * zoomFactor;
          m.scale.set(s, s, s);

          if (m.userData?.type === "station") {
            m.position.z = Math.sin(t * 0.5 + i * 1.8) * 2 * zoomFactor;
          }
          if (m.userData?.type === "car") {
            m.position.z = 0;
            // Only apply heading rotation when in navigation mode
            if (navigationMode) {
              const headingRad = ((m.userData?.heading ?? 0) * Math.PI) / 180;
              m.rotation.set(Math.PI / 2, 0, -headingRad);
            } else {
              m.rotation.set(Math.PI / 2, 0, 0);
            }
          }
        });

        const proj = new THREE.Matrix4().fromArray(matrix);
        const local = new THREE.Matrix4()
          .makeTranslation(refX, refY, 0)
          .scale(new THREE.Vector3(scale, -scale, scale));

        camera.projectionMatrix = proj.multiply(local);
        renderer.resetState();
        renderer.render(scene, camera);
        map.triggerRepaint();
      },
    };

    try { if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID); } catch { /* */ }
    map.addLayer(customLayer as any);

    return () => {
      disposed = true;
      carModelRef.current = null;
      sceneRefData.current = null;
      try { if (map.getStyle() && map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID); } catch { /* */ }
      allModels.forEach((m) =>
        m.traverse((child) => {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (mesh.material) {
            (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
              .forEach((mat) => mat.dispose());
          }
        })
      );
      renderer?.dispose();
    };
    
  }, [mapLoaded, stations, centerLat, centerLng]);

  /* ─── Real-time car position + heading update (via refs) ─── */
  useEffect(() => {
    const car = carModelRef.current;
    const rd = sceneRefData.current;
    if (!car || !rd) return;

    if (userLocation) {
      const dx = (lngToMercX(userLocation.lng) - rd.refX) / rd.scale;
      const dy = (rd.refY - latToMercY(userLocation.lat)) / rd.scale;
      car.position.set(dx, dy, car.position.z);
      car.visible = true;
    } else {
      car.visible = false;
    }

    if (userHeading != null) {
      car.userData.heading = userHeading;
    }

    mapObjRef.current?.triggerRepaint();
  }, [userLocation, userHeading]);

  /* ─── Navigation: compute current step, distance, ETA ─── */
  useEffect(() => {
    if (!navigationMode || !routeData || !userLocation) return;

    const coords = routeData.geometry.coordinates;
    const { segIndex, distKm } = findClosestOnRoute(
      userLocation.lat, userLocation.lng, coords
    );

    // remaining distance
    const remaining = distanceAlongRouteRemaining(coords, segIndex, 0);
    setDistRemaining(remaining);

    // ETA based on current speed or route average
    const speedMs = (userSpeed && userSpeed > 0.5) ? userSpeed : (routeData.distance / routeData.duration);
    const etaSec = (remaining * 1000) / speedMs;
    setEtaSeconds(etaSec);

    // Find which step we're on
    const steps = routeData.steps;
    if (steps.length > 0) {
      let cumDist = 0;
      let progressed = 0;
      // distance traveled from start ≈ totalDist - remaining
      const traveled = (routeData.distance / 1000) - remaining;
      for (let i = 0; i < steps.length; i++) {
        cumDist += steps[i].distance / 1000;
        if (cumDist >= traveled) {
          progressed = i;
          break;
        }
        progressed = i;
      }
      setCurrentStepIdx(progressed);
    }
  }, [navigationMode, routeData, userLocation, userSpeed]);

  /* ─── Follow camera in navigation mode ─── */
  useEffect(() => {
    if (!navigationMode || !followCamera || !userLocation || !mapRef.current) return;
    if (userInteractedRef.current) return;

    const map = mapRef.current.getMap();
    const bearing = userHeading ?? map.getBearing();

    map.easeTo({
      center: [userLocation.lng, userLocation.lat],
      bearing,
      pitch: 70,
      zoom: 16.5,
      duration: 800,
    });
  }, [navigationMode, followCamera, userLocation, userHeading]);

  /* ─── Re-center button restores follow camera ─── */
  const reCenter = useCallback(() => {
    userInteractedRef.current = false;
    setFollowCamera(true);
  }, []);

  /* ─── Scroll-to-pitch ─── */
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current.getMap();
    const canvas = map.getCanvas();

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const currentPitch = map.getPitch();
        const delta = e.deltaY > 0 ? -2 : 2;
        map.easeTo({
          pitch: Math.max(0, Math.min(85, currentPitch + delta)),
          duration: 100,
        });
      }
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [mapLoaded]);

  /* ─── Fit map to route bounds when route is set (not in nav mode) ─── */
  useEffect(() => {
    if (!routeData) {
      lastFittedRouteRef.current = null;
      return;
    }
    if (!mapLoaded || !mapRef.current || navigationMode) return;
    const coords = routeData.geometry.coordinates;
    if (coords.length < 2) return;

    // Only fit bounds once per distinct route (prevent re-zoom on reference change)
    const routeKey = `${coords[0][0]},${coords[0][1]}-${coords[coords.length - 1][0]},${coords[coords.length - 1][1]}`;
    if (lastFittedRouteRef.current === routeKey) return;
    lastFittedRouteRef.current = routeKey;

    const map = mapRef.current.getMap();
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: 80, pitch: 45, duration: 1500 }
    );
  }, [mapLoaded, routeData, navigationMode]);

  /* ─── Fly to user location when set (no route, no nav) ─── */
  useEffect(() => {
    if (!userLocation) {
      hasFlownToUserRef.current = false;
      return;
    }
    if (!mapLoaded || !mapRef.current || routeData || navigationMode) return;
    // Only fly once per location activation (prevent re-zoom on reference change)
    if (hasFlownToUserRef.current) return;
    hasFlownToUserRef.current = true;

    const map = mapRef.current.getMap();
    map.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 12,
      pitch: 55,
      duration: 1500,
    });
  }, [mapLoaded, userLocation, routeData, navigationMode]);

  /* ─── Fallback when token missing ─── */
  if (!token) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-border bg-muted ${className}`}
      >
        <div className="text-center">
          <MapPin className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Map is unavailable. Please configure NEXT_PUBLIC_MAPBOX_TOKEN in
            your environment variables.
          </p>
        </div>
      </div>
    );
  }

  const availablePorts = (station: IStation) =>
    station.chargingPorts?.filter((p) => p.status === "available").length ?? 0;

  const totalPorts = (station: IStation) => station.chargingPorts?.length ?? 0;

  const currentStep: RouteStep | null =
    routeData?.steps?.[currentStepIdx] ?? null;
  const nextStep: RouteStep | null =
    routeData?.steps?.[currentStepIdx + 1] ?? null;

  // Format helpers
  const fmtDist = (km: number) =>
    km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  const fmtEta = (sec: number) => {
    if (sec < 60) return "< 1 min";
    if (sec < 3600) return `${Math.round(sec / 60)} min`;
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };
  const fmtSpeed = (ms: number | null) =>
    ms != null ? `${Math.round(ms * 3.6)} km/h` : "—";

  return (
    <div className={`overflow-hidden rounded-xl shadow-2xl relative ${className}`}>
      <Map
        ref={mapRef}
        initialViewState={{
          latitude: center.lat,
          longitude: center.lng,
          zoom,
          pitch: 60,
          bearing: -17.6,
        }}
        mapStyle="mapbox://styles/mapbox/standard"
        mapboxAccessToken={token}
        style={{ width: "100%", height: "100%" }}
        interactive={interactive}
        maxPitch={85}
        onClick={handleMapClick}
        onLoad={() => setMapLoaded(true)}
      >
        <NavigationControl position="top-right" visualizePitch />

        {/* Station popup */}
        {selectedStation && (
          <Popup
            latitude={selectedStation.location?.coordinates?.lat ?? 0}
            longitude={selectedStation.location?.coordinates?.lng ?? 0}
            anchor="bottom"
            offset={35}
            onClose={() => setSelectedStation(null)}
            closeOnClick={false}
          >
            <div className="min-w-[220px] p-2">
              <h3 className="text-sm font-semibold text-foreground">
                {selectedStation.name}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedStation.location?.address}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedStation.chargingPorts
                  ?.map((p) => p.connectorType)
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map((type) => (
                    <span
                      key={type}
                      className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                    >
                      {getConnectorLabel(type)}
                    </span>
                  ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-green-600">
                  {availablePorts(selectedStation)}
                </span>{" "}
                / {totalPorts(selectedStation)} ports available
              </p>
              <Link
                href={`/stations/${selectedStation._id}`}
                className="mt-2 block rounded-md bg-primary px-3 py-1.5 text-center text-xs font-medium text-white transition-colors hover:bg-primary/90"
              >
                View Details
              </Link>
            </div>
          </Popup>
        )}

        {/* Route line */}
        {routeData && (
          <>
            <Source
              id="route"
              type="geojson"
              data={{
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: routeData.geometry.coordinates,
                },
              }}
            >
              <Layer
                id="route-glow"
                type="line"
                paint={{
                  "line-color": navigationMode ? "#22c55e" : "#3b82f6",
                  "line-width": navigationMode ? 14 : 10,
                  "line-opacity": 0.25,
                  "line-blur": 6,
                }}
              />
              <Layer
                id="route-line"
                type="line"
                paint={{
                  "line-color": navigationMode ? "#22c55e" : "#3b82f6",
                  "line-width": navigationMode ? 6 : 4,
                  "line-opacity": 0.9,
                }}
                layout={{
                  "line-cap": "round",
                  "line-join": "round",
                }}
              />
            </Source>

            {/* Start marker */}
            <Marker
              latitude={routeData.geometry.coordinates[0][1]}
              longitude={routeData.geometry.coordinates[0][0]}
              anchor="center"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 shadow-lg ring-2 ring-white/40">
                <div className="h-2 w-2 rounded-full bg-white" />
              </div>
            </Marker>

            {/* End marker */}
            <Marker
              latitude={routeData.geometry.coordinates[routeData.geometry.coordinates.length - 1][1]}
              longitude={routeData.geometry.coordinates[routeData.geometry.coordinates.length - 1][0]}
              anchor="center"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 shadow-lg ring-2 ring-white/40">
                <Flag className="h-3 w-3 text-white" />
              </div>
            </Marker>
          </>
        )}
      </Map>

      {/* ═══════ Navigation Mode Overlay ═══════ */}
      {navigationMode && routeData && (
        <>
          {/* Top: Turn-by-turn instruction card */}
          <div className="absolute top-2 left-2 right-12 sm:top-4 sm:left-4 sm:right-16 z-10">
            <div className="rounded-xl sm:rounded-2xl bg-[#1a2332]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
              {/* Current maneuver */}
              {currentStep && (
                <div className="flex items-center gap-2.5 p-2.5 sm:gap-4 sm:p-4">
                  <div className="flex h-10 w-10 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-primary">
                    <ManeuverIcon
                      type={currentStep.maneuver.type}
                      modifier={currentStep.maneuver.modifier}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-lg font-bold text-white leading-tight truncate">
                      {currentStep.maneuver.instruction}
                    </p>
                    <div className="mt-0.5 sm:mt-1 flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-white/60">
                      <span className="font-medium text-white/80">
                        {fmtDist(currentStep.distance / 1000)}
                      </span>
                      {currentStep.name && (
                        <span className="truncate">on {currentStep.name}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Next step preview */}
              {nextStep && (
                <div className="flex items-center gap-2 sm:gap-3 border-t border-white/5 bg-white/[0.03] px-2.5 py-1.5 sm:px-4 sm:py-2.5">
                  <div className="flex h-6 w-6 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-md sm:rounded-lg bg-white/10">
                    <ManeuverIcon
                      type={nextStep.maneuver.type}
                      modifier={nextStep.maneuver.modifier}
                    />
                  </div>
                  <p className="text-[10px] sm:text-xs text-white/50 truncate flex-1">
                    Then: {nextStep.maneuver.instruction}
                  </p>
                  <span className="text-[10px] sm:text-xs font-medium text-white/40">
                    {fmtDist(nextStep.distance / 1000)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom: Stats bar */}
          <div className="absolute bottom-0 left-0 right-0 z-10">
            <div className="bg-[#1a2332]/95 backdrop-blur-xl border-t border-white/10">
              <div className="grid grid-cols-4 gap-1 px-3 py-2.5 sm:flex sm:items-center sm:justify-between sm:px-6 sm:py-4">
                {/* ETA */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <div>
                    <p className="text-sm sm:text-xl font-bold text-white">{fmtEta(etaSeconds)}</p>
                    <p className="text-[8px] sm:text-[10px] text-white/40 uppercase tracking-wider">ETA</p>
                  </div>
                </div>

                {/* Distance */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Navigation2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
                  <div>
                    <p className="text-sm sm:text-xl font-bold text-white">{fmtDist(distRemaining)}</p>
                    <p className="text-[8px] sm:text-[10px] text-white/40 uppercase tracking-wider">Left</p>
                  </div>
                </div>

                {/* Speed */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Gauge className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
                  <div>
                    <p className="text-sm sm:text-xl font-bold text-white">{fmtSpeed(userSpeed)}</p>
                    <p className="text-[8px] sm:text-[10px] text-white/40 uppercase tracking-wider">Speed</p>
                  </div>
                </div>

                {/* End navigation */}
                <button
                  onClick={onToggleNavigation}
                  className="flex items-center justify-center gap-1 sm:gap-2 rounded-lg sm:rounded-xl bg-red-500/90 px-2 py-2 sm:px-5 sm:py-3 text-xs sm:text-sm font-bold text-white transition-all hover:bg-red-500 active:scale-95"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  End
                </button>
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-white/5">
                <div
                  className="h-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
                  style={{
                    width: `${Math.max(2, Math.min(100, ((routeData.distance / 1000 - distRemaining) / (routeData.distance / 1000)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Re-center floating button (shows when user panned away) */}
          {userInteractedRef.current && (
            <button
              onClick={reCenter}
              className="absolute bottom-28 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[#1a2332]/90 shadow-xl border border-white/10 text-primary transition-all hover:bg-[#1a2332] active:scale-95"
            >
              <Locate className="h-5 w-5" />
            </button>
          )}
        </>
      )}

      {/* ═══════ Start Navigation Button (when route exists but not navigating) ═══════ */}
      {!navigationMode && routeData && userLocation && onToggleNavigation && (
        <div className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={onToggleNavigation}
            className="flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl bg-primary px-5 py-3 sm:px-8 sm:py-4 text-sm sm:text-base font-bold text-white shadow-2xl shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-primary/50 active:scale-95"
          >
            <Navigation className="h-4 w-4 sm:h-5 sm:w-5" />
            Start Navigation
          </button>
        </div>
      )}

      {/* Scroll hint (hidden on mobile & in nav mode) */}
      {!navigationMode && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-10 hidden sm:block">
          <div className="rounded-full bg-black/50 px-3 py-1 text-[10px] text-white/70 backdrop-blur-sm">
            Ctrl + scroll to tilt • Drag to pan • Right-drag to rotate
          </div>
        </div>
      )}
    </div>
  );
}

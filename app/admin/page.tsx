"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  MapPin,
  Calendar,
  DollarSign,
  Zap,
  ArrowRight,
  ScanLine,
  TrendingUp,
  TrendingDown,
  Shield,
  Plus,
  Users,
  Battery,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { cn, formatPrice } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";

interface AdminAnalytics {
  revenue: { total: number; currency: string; period: string };
  bookings: { total: number; byStatus: Record<string, number> };
  topStations: Array<{
    _id: string;
    bookingCount: number;
    revenue: number;
    stationName: string;
    city: string;
  }>;
  overview: {
    totalStations: number;
    totalUsers: number;
    totalPorts: number;
    portsByStatus: Record<string, number>;
    utilizationRate: number;
  };
  dailyBookings: Array<{ _id: string; count: number; revenue: number }>;
}

export default function AdminDashboardPage() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState<string>("admin");

  useEffect(() => {
    async function fetchData() {
      try {
        const [analyticsRes, roleRes] = await Promise.all([
          fetch("/api/admin/analytics"),
          fetch("/api/users/role"),
        ]);
        if (analyticsRes.ok) {
          const data = await analyticsRes.json();
          setAnalytics(data);
        } else if (analyticsRes.status === 403) {
          setError("Access denied");
        }
        if (roleRes.ok) {
          const roleData = await roleRes.json();
          setRole(roleData.role || "admin");
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
        setError("Failed to load analytics. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading analytics...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const totalBookings = analytics?.bookings?.total ?? 0;
  const activeBookings = analytics?.bookings?.byStatus?.active ?? 0;
  const availablePorts = analytics?.overview?.portsByStatus?.available ?? 0;
  const totalPorts = analytics?.overview?.totalPorts ?? 0;
  const utilizationRate = analytics?.overview?.utilizationRate ?? 0;

  const stats = [
    {
      label: role === "superadmin" ? "All Stations" : "My Stations",
      value: analytics?.overview?.totalStations ?? 0,
      icon: MapPin,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      cardClass: "stat-card stat-card-blue",
    },
    {
      label: role === "superadmin" ? "Total Bookings" : "My Bookings",
      value: totalBookings,
      icon: Calendar,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      cardClass: "stat-card stat-card-green",
    },
    {
      label: "Revenue",
      value: formatPrice(analytics?.revenue?.total ?? 0),
      icon: DollarSign,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      cardClass: "stat-card stat-card-purple",
    },
    {
      label: "Active Sessions",
      value: activeBookings,
      icon: Zap,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      cardClass: "stat-card stat-card-amber",
    },
  ];

  const chartData = (analytics?.dailyBookings ?? []).map((d) => ({
    date: d._id,
    revenue: d.revenue,
    bookings: d.count,
  }));

  const topStations = analytics?.topStations ?? [];

  return (
    <div className="h-full overflow-y-auto">
      {/* ── Header ── */}
      <div className="border-b border-border/50 bg-surface px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Shield className="h-3 w-3" />
              {role === "superadmin" ? "Super Admin" : "Station Admin"}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              Dashboard Overview
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {role === "superadmin"
                ? "Monitor your entire charging network"
                : "Monitor your station performance"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/stations/new"
              className="hidden items-center gap-1.5 rounded-lg border border-border/50 bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/5 sm:inline-flex"
            >
              <Plus className="h-4 w-4" />
              New Station
            </Link>
            <Link
              href="/admin/scan"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              <ScanLine className="h-4 w-4" />
              Scan QR
            </Link>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
        {/* ── Stats Cards ── */}
        <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={cn(
                  "card-hover animate-fade-in-up rounded-xl border border-border/50 bg-card p-4",
                  stat.cardClass
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-xl",
                      stat.bg
                    )}
                  >
                    <Icon className={cn("h-5 w-5", stat.color)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Chart + Port Status Row ── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 animate-fade-in-up rounded-xl border border-border/50 bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BarChart3 className="h-4 w-4 text-primary" />
                Revenue Overview
              </h2>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                {analytics?.revenue?.period ?? "This month"}
              </span>
            </div>
            {chartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="revenueGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#3b82f6"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#3b82f6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(30,41,59,0.5)"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={{ stroke: "rgba(30,41,59,0.5)" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={{ stroke: "rgba(30,41,59,0.5)" }}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatPrice(Number(value)),
                        "Revenue",
                      ]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid rgba(30,41,59,0.8)",
                        background: "#1a2332",
                        color: "#f1f5f9",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                      }}
                      labelStyle={{ color: "#94a3b8" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No revenue data available yet.
              </p>
            )}
          </div>

          {/* Port Status + Quick Actions */}
          <div className="space-y-4 animate-fade-in-up">
            {/* Port Status */}
            <div className="rounded-xl border border-border/50 bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Battery className="h-4 w-4 text-emerald-400" />
                Port Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="status-dot status-dot-available" />
                    <span className="text-xs text-muted-foreground">
                      Available
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {availablePorts}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="status-dot status-dot-occupied" />
                    <span className="text-xs text-muted-foreground">
                      Occupied
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {analytics?.overview?.portsByStatus?.occupied ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="status-dot status-dot-offline" />
                    <span className="text-xs text-muted-foreground">
                      Offline
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {analytics?.overview?.portsByStatus?.offline ?? 0}
                  </span>
                </div>
                {/* Utilization bar */}
                <div className="mt-2 pt-2 border-t border-border/30">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Utilization</span>
                    <span className="font-semibold text-foreground">
                      {utilizationRate.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-1000"
                      style={{ width: `${utilizationRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border border-border/50 bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <Link
                  href="/admin/stations"
                  className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-white/5"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                    <MapPin className="h-4 w-4 text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    Manage Stations
                  </span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </Link>
                <Link
                  href="/admin/bookings"
                  className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-white/5"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Calendar className="h-4 w-4 text-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    Manage Bookings
                  </span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </Link>
                <Link
                  href="/admin/stations/new"
                  className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-white/5"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                    <Plus className="h-4 w-4 text-amber-400" />
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    Add New Station
                  </span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </Link>
                {role === "superadmin" && (
                  <Link
                    href="/admin/users"
                    className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-white/5"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                      <Users className="h-4 w-4 text-purple-400" />
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      Manage Users
                    </span>
                    <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Top Stations Table ── */}
        <div className="animate-fade-in-up rounded-xl border border-border/50 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Top Performing Stations
            </h2>
            <Link
              href="/admin/stations"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              View All →
            </Link>
          </div>

          <div className="dark-table overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    #
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Station
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    City
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Bookings
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {topStations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-sm text-muted-foreground"
                    >
                      No booking data yet.
                    </td>
                  </tr>
                ) : (
                  topStations.map((station, index) => (
                    <tr
                      key={station._id}
                      className="transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                            index === 0
                              ? "bg-amber-500/20 text-amber-400"
                              : index === 1
                                ? "bg-slate-500/20 text-slate-300"
                                : index === 2
                                  ? "bg-amber-700/20 text-amber-500"
                                  : "bg-card text-muted-foreground"
                          )}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-foreground">
                        {station.stationName}
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        {station.city}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                          {station.bookingCount}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-emerald-400">
                        {formatPrice(station.revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

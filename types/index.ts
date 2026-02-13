export interface Plug {
  plug: string;
  power: string;
  type: string;
}

export interface StationLocation {
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  city: string;
  province: string;
}

export interface ChargingPort {
  _id?: string;
  portNumber: string;
  connectorType: string;
  powerOutput: string;
  chargerType: string;
  status: "available" | "occupied" | "maintenance" | "reserved";
  currentBookingId?: string;
}

export interface IStation {
  _id: string;
  name: string;
  adminId?: string;
  location: StationLocation;
  telephone: string;
  vehicleTypes: string[];
  operatingHours: {
    open: string;
    close: string;
  };
  chargingPorts: ChargingPort[];
  pricing: {
    perHour: number;
    depositAmount: number;
  };
  amenities: string[];
  photos: string[];
  rating: number;
  totalReviews: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IBooking {
  _id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  stationId: string | IStation;
  portId: string;
  startTime: string;
  estimatedDuration: number;
  endTime: string;
  status: "pending" | "confirmed" | "active" | "completed" | "cancelled" | "no-show";
  deposit: {
    amount: number;
    khaltiPidx?: string;
    khaltiTransactionId?: string;
    refunded: boolean;
  };
  qrCode?: string;
  userLocation?: {
    lat: number;
    lng: number;
  };
  eta?: {
    durationMinutes: number;
    distanceKm: number;
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface IReview {
  _id: string;
  userId: string;
  userName?: string;
  stationId: string;
  bookingId: string;
  rating: number;
  comment: string;
  response?: {
    text: string;
    respondedAt: string;
  };
  createdAt: string;
}

export interface IUser {
  _id: string;
  clerkId: string;
  email: string;
  name: string;
  phone?: string;
  role: "user" | "admin" | "superadmin";
  vehicleInfo?: {
    make: string;
    model: string;
    batteryCapacity: number;
    connectorType: string;
  };
  favoriteStations: string[];
  createdAt: string;
}

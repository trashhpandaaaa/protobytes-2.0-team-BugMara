# Urja Station - EV Charging Station Management Platform

## Team Information

**Team Name:** BugMara

### Team Members:

| Name | Email | GitHub Username |
|------|-------|-----------------|
| Rasul Ghatane | rasulghatane@gmail.com | @rasulghatane |
| Suprim Joshi | suprimjoshi111@gmail.com | @SJ-Slasher |
| Sarad Kafle | kaflesarad2@gmail.com | @kaflesarad |
| Pratyush Neupane | pratyushisneupane@gmail.com | @Pratgod2025 |


## Project Details

### Project Title: **Urja Station**

### Category: [x] Open Innovation

### Problem Statement

Nepal's growing EV adoption lacks a centralized platform for locating, booking, and managing charging stations. Station owners have no unified system to track revenue, manage ports, or handle walk-in customers. EV drivers struggle to find available chargers, plan routes, and make payments — leading to range anxiety and poor charging infrastructure utilization.

### Solution Overview

**Urja Station** is a full-stack EV charging station management platform that connects EV drivers with charging stations across Nepal. Drivers can discover nearby stations on an interactive 3D map with real-time availability, book charging slots, plan multi-stop routes, make payments via Khalti, and leave reviews. Station admins get a dedicated dashboard to manage their stations, monitor port availability in real-time, track revenue analytics, handle online bookings, and log walk-in sessions with a single tap. The platform features 3D GLB model rendering of charging stations on a Mapbox terrain map, role-based access control (User, Station Admin, Super Admin), and a responsive dark-themed UI optimized for both desktop and mobile.

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| **Backend** | Next.js API Routes (Server-side), Mongoose ODM |
| **Database** | MongoDB Atlas |
| **Authentication** | Clerk (OAuth, Email/Password) |
| **Maps & 3D** | Mapbox GL JS v3 (Standard Style, 3D Terrain), Three.js (GLB model rendering) |
| **Payments** | Khalti Payment Gateway (Sandbox) |
| **UI Components** | Radix UI, Lucide Icons, Framer Motion |
| **Styling** | Tailwind CSS with CSS custom properties (dark theme) |
| **Deployment** | Vercel-ready, Edge-compatible |

---

## Features

### For EV Drivers (User)
- **Interactive 3D Map** — Discover charging stations rendered as 3D models on terrain-aware Mapbox map
- **Nearest Stations** — GPS-based proximity sorting with distance display
- **Real-time Availability** — See available/occupied/offline ports per station
- **Station Details** — Connector types, pricing, amenities, photos, ratings & reviews
- **Slot Booking** — Book a specific port for a time slot with duration selection
- **Route Planner** — Plan routes between two locations with charging stops along the way
- **Khalti Payments** — Secure online payment integration for bookings
- **Favorites** — Save frequently used stations for quick access
- **User Dashboard** — View upcoming bookings, active sessions, and booking history
- **QR Check-in** — Scan station QR codes for quick walk-in registration

### For Station Admins
- **Admin Dashboard** — Revenue overview, booking stats, port utilization metrics
- **Station Management** — Edit station details, pricing, amenities, and photos
- **Port Management** — Monitor and toggle port status (available/occupied/offline)
- **Booking Management** — View, confirm, and manage incoming bookings
- **Walk-in Logging** — One-tap Start/Stop timer for walk-in customers with auto revenue calculation
- **QR Code Generation** — Per-port QR codes for customer self-check-in
- **Revenue Analytics** — Track earnings from both online bookings and walk-in sessions

### For Super Admins
- **Platform Overview** — Total stations, users, bookings, and revenue across the platform
- **User Management** — View and manage all registered users and their roles
- **Station Oversight** — Monitor all stations and their performance

### UI/UX
- **Dark Theme** — Consistent dark UI across all pages
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Glass Morphism** — Modern card designs with backdrop blur effects
- **Smooth Animations** — Framer Motion transitions and loading states
- **3D Model Rendering** — Custom GLB charger models with terrain elevation tracking

---

## Installation & Setup

### Prerequisites
- Node.js 18+ and npm/yarn/pnpm
- MongoDB Atlas account (or local MongoDB)
- Clerk account (for authentication)
- Mapbox account (for maps)
- Khalti merchant account (for payments, sandbox mode)

### Step-by-step instructions

```bash
# 1. Clone the repository
git clone https://github.com/SJ-Slasher/protobytes-2.0-team-BugMara.git

# 2. Navigate to project folder
cd protobytes-2.0-team-BugMara

# 3. Install dependencies
npm install

# 4. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your actual keys (see Environment Variables section below)

# 5. Seed the database with station data
npx ts-node scripts/seed-stations.ts

# 6. Start the development server
npm run dev

# 7. Open in browser
# http://localhost:3000
```

### Environment Variables

Create a `.env.local` file in the root directory with the following:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_DASHBOARD_URL=/dashboard

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/urja-station

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token

# Khalti Payment Gateway
KHALTI_SECRET_KEY=your_khalti_secret_key
KHALTI_ENV=sandbox
```

### Build for Production

```bash
npm run build
npm start
```

---

## Demo Credentials

| Role | Email | How to Access |
|------|-------|---------------|
| **User** | Sign up with any email via Clerk | Default role on sign-up |
| **Station Admin** | rasulghatane@gmail.com | Manages "Hundai Service (L I Auto Service)" |
| **Station Admin** | rasulghatane1234@gmail.com | Manages "Siddhartha Riverside Resort TATA" |

> Users sign up through Clerk OAuth (Google) or email/password. Role assignment is handled server-side.

---

## Screenshots / Demo

### Interactive 3D Map with Station Models
![Map View](screenshots/map-view.png)
*3D charging station models rendered on Mapbox terrain with real-time availability*

### Station Admin Dashboard
![Admin Dashboard](screenshots/admin-dashboard.png)
*Revenue overview, port status, booking management, and quick actions*

### Station Details & Booking
![Station Details](screenshots/station-details.png)
*Station information, port availability, reviews, and booking flow*

### Walk-in Session Tracking
![Walk-in](screenshots/walk-in.png)
*One-tap Start/Stop timer for logging walk-in customers*

### Route Planner
![Route Planner](screenshots/route-planner.png)
*Plan routes with charging stops along the way*

### User Dashboard
![User Dashboard](screenshots/user-dashboard.png)
*Booking history, active sessions, and favorite stations*

> **Demo Video:**

> To DO!!

---

## Project Structure

```
├── app/
│   ├── api/                    # API Routes
│   │   ├── admin/              # Admin APIs (analytics, bookings, stations, walk-in)
│   │   ├── bookings/           # Booking CRUD & Khalti payment
│   │   ├── favorites/          # User favorites
│   │   ├── reviews/            # Station reviews
│   │   ├── route-planner/      # Route planning with charging stops
│   │   ├── stations/           # Station CRUD & search
│   │   └── users/              # User creation & role management
│   ├── admin/                  # Station Admin pages
│   │   ├── bookings/           # Manage bookings
│   │   ├── stations/           # Manage stations
│   │   ├── walk-in/            # Walk-in session logging
│   │   └── page.tsx            # Admin dashboard
│   ├── booking/                # Booking flow pages
│   ├── dashboard/              # User dashboard
│   │   ├── bookings/           # User booking history
│   │   ├── favorites/          # User favorites
│   │   └── profile/            # User profile
│   ├── stations/               # Station detail pages
│   ├── sign-in/                # Clerk sign-in
│   ├── sign-up/                # Clerk sign-up
│   ├── walk-in/                # QR-based walk-in check-in
│   └── page.tsx                # Home / Map view
├── components/
│   ├── map/                    # StationMap, MapPopup, RoutePanel
│   ├── stations/               # StationCard, PortAvailability, ReviewForm
│   ├── booking/                # BookingCard, BookingForm
│   ├── layout/                 # Sidebar, Navbar
│   └── ui/                     # Reusable UI components
├── lib/
│   ├── models/                 # Mongoose models (User, Station, Booking, Favorite, Review)
│   ├── db.ts                   # MongoDB connection
│   └── utils.ts                # Utility functions
├── public/
│   └── models/                 # 3D GLB models for map rendering
├── scripts/
│   └── seed-stations.ts        # Database seeding script
└── data/
    └── ev_stations.json        # Station data source
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stations` | List all stations (with search/filter) |
| GET | `/api/stations/[id]` | Get station details |
| POST | `/api/bookings` | Create a booking |
| GET | `/api/bookings` | Get user's bookings |
| PATCH | `/api/bookings` | Update booking status |
| POST | `/api/bookings/khalti/initiate` | Initiate Khalti payment |
| POST | `/api/bookings/khalti/verify` | Verify Khalti payment |
| GET | `/api/favorites` | Get user's favorites |
| POST | `/api/favorites` | Toggle favorite |
| POST | `/api/reviews` | Submit a review |
| GET | `/api/admin/analytics` | Admin dashboard analytics |
| GET | `/api/admin/bookings` | Admin booking management |
| POST | `/api/admin/walk-in` | Start/Stop walk-in session |
| GET | `/api/admin/walk-in` | Get active walk-in sessions |
| POST | `/api/route-planner` | Plan route with charging stops |

---

## Git Commit Message Format

This project follows structured commit messages:

```
<type>(<scope>): <short description>

[optional body]
```

### Types Used:
- `feat` — New feature
- `fix` — Bug fix
- `style` — UI/styling changes
- `refactor` — Code restructuring
- `chore` — Maintenance, config, cleanup
- `docs` — Documentation updates

### Examples:
```
feat(map): add 3D GLB model rendering for charging stations
fix(walk-in): resolve Start button not working due to ObjectId mismatch
style(theme): lighten dark UI colors for better readability
chore(seed): update all stations to have 3 ports each
feat(admin): add walk-in session tracking with one-tap Start/Stop
fix(3d): prevent models sinking into terrain using elevation queries
```

---

## License

This project was built for **Protobytes 2.0 Hackathon**.

---

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import {
  Zap,
  LayoutDashboard,
  MapPin,
  Calendar,
  Heart,
  Settings,
  Shield,
  Users,
  BarChart3,
  CreditCard,
  QrCode,
  ChevronLeft,
  ChevronRight,
  Building2,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const userLinks = [
  { href: "/", label: "Map View", icon: MapPin },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/bookings", label: "My Bookings", icon: Calendar },
  { href: "/dashboard/favorites", label: "Favorites", icon: Heart },
  { href: "/dashboard/profile", label: "Profile", icon: Settings },
];

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/stations", label: "My Stations", icon: Building2 },
  { href: "/admin/bookings", label: "Bookings", icon: Calendar },
  { href: "/admin/scan", label: "QR Scan", icon: QrCode },
];

const superAdminLinks = [
  { href: "/admin", label: "Analytics", icon: BarChart3 },
  { href: "/admin/stations", label: "All Stations", icon: Building2 },
  { href: "/admin/bookings", label: "Transactions", icon: CreditCard },
  { href: "/admin/users", label: "User Management", icon: Users },
  { href: "/admin/scan", label: "QR Scan", icon: QrCode },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRole] = useState<string>("user");
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isSignedIn) {
      setRole("user");
      return;
    }

    async function checkRole() {
      try {
        const res = await fetch("/api/users/role");
        if (res.ok) {
          const data = await res.json();
          setRole(data.role || "user");
        }
      } catch {
        setRole("user");
      }
    }

    checkRole();
  }, [isSignedIn]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Hide sidebar on auth pages
  const isAuthPage =
    pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  if (isAuthPage) return null;

  const isAdminPage = pathname.startsWith("/admin");
  const links =
    isAdminPage && role === "superadmin"
      ? superAdminLinks
      : isAdminPage && role === "admin"
        ? adminLinks
        : userLinks;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border/50">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold text-foreground whitespace-nowrap">
            Urja Station
          </span>
        )}
        {/* Close button on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav Section */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        {!collapsed && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-2">
            {isAdminPage ? "Admin" : "Navigation"}
          </p>
        )}

        <nav className="flex flex-col gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href) &&
                  (link.href !== "/admin" || pathname === "/admin");
            return (
              <Link
                key={link.href}
                href={link.href}
                title={collapsed ? link.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-primary/15 text-primary shadow-sm shadow-primary/10"
                    : "text-sidebar-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Admin quick link for non-admin pages */}
        {!isAdminPage && (role === "admin" || role === "superadmin") && (
          <>
            {!collapsed && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mt-6 mb-2">
                Admin
              </p>
            )}
            <Link
              href="/admin"
              title={collapsed ? "Admin Panel" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                collapsed && "justify-center px-2",
                "text-sidebar-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Shield className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>Admin Panel</span>}
            </Link>
          </>
        )}

        {/* Switch to user view from admin */}
        {isAdminPage && (
          <>
            {!collapsed && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mt-6 mb-2">
                User
              </p>
            )}
            <Link
              href="/"
              title={collapsed ? "Map View" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                collapsed && "justify-center px-2",
                "text-sidebar-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <MapPin className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>Map View</span>}
            </Link>
          </>
        )}
      </div>

      {/* Bottom area */}
      <div className="border-t border-border/50 p-3">
        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors mb-2"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>

        {/* User section */}
        <SignedOut>
          <SignInButton mode="modal">
            <button
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90",
                collapsed && "px-2"
              )}
            >
              {!collapsed && "Sign In"}
              {collapsed && <Zap className="h-4 w-4" />}
            </button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-2",
              collapsed && "justify-center"
            )}
          >
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {user?.firstName || "User"}
                </p>
                <p className="truncate text-xs text-muted-foreground capitalize">
                  {role === "superadmin" ? "Super Admin" : role}
                </p>
              </div>
            )}
          </div>
        </SignedIn>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button — fixed top-left */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar/95 backdrop-blur-sm border border-border/50 shadow-lg text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — mobile: slide-over, desktop: static */}
      <aside
        className={cn(
          // Desktop
          "hidden lg:flex flex-col bg-sidebar border-r border-border/50 transition-all duration-300 ease-in-out h-screen sticky top-0 z-40",
          collapsed ? "lg:w-[68px]" : "lg:w-[240px]",
          // Mobile overrides handled below
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-sidebar border-r border-border/50 transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

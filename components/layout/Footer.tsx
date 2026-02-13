import Link from "next/link";
import { Zap, Github, Mail, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">Urja Station</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Find, book, and charge your electric vehicle at stations across Nepal.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Quick Links</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Find Stations
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/dashboard/bookings" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  My Bookings
                </Link>
              </li>
              <li>
                <Link href="/dashboard/favorites" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Favorites
                </Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Account</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/dashboard/profile" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  My Profile
                </Link>
              </li>
              <li>
                <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/sign-up" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Sign Up
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Contact</h3>
            <ul className="mt-3 space-y-2">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Kathmandu, Nepal
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                support@urjastation.com
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Urja Station. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

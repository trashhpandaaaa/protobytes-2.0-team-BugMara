import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Sidebar } from "@/components/layout/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Urja Station - EV Charging Station Booking",
    template: "%s | Urja Station",
  },
  description:
    "Find, book, and charge your electric vehicle at stations across Nepal",
  keywords: ["EV charging", "electric vehicle", "Nepal", "booking", "Urja Station"],
  authors: [{ name: "Team BugMara" }],
  icons: {
    icon: "/favicon/favicon.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body className="min-h-screen bg-background antialiased">
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}

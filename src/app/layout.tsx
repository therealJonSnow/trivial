import type { Metadata, Viewport } from "next";
import { Saira_Condensed, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";

/**
 * Type system. Self-hosted by next/font at build time — no runtime fetch, so the
 * PWA stays offline-safe.
 *   · Saira Condensed — squared, signage-grade display for headings / labels.
 *   · JetBrains Mono — tabular technical numerals for the instrument readouts.
 */
const display = Saira_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trivial — pursuit race timer",
  description: "Make pursuit trivial. A phone-friendly pursuit race start timer.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Trivial", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${display.variable} ${mono.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}

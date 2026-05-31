import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "Trivial — pursuit race timer",
  description: "Make pursuit trivial. A phone-friendly pursuit race start timer.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Trivial", statusBarStyle: "black-translucent" },
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
    <html lang="en-GB">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Saira_Condensed, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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
  // theme-color is set by the bootstrap script below so it matches the resolved
  // light/dark theme rather than being pinned to one value.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

/**
 * Runs before first paint: applies the saved theme (else device preference) to
 * <html> so there's no flash of the wrong palette. Mirrors `resolveInitialTheme`
 * + `applyTheme` in lib/theme.ts (kept inline because it must run pre-hydration).
 */
const themeBootstrap = `(function(){try{var t=localStorage.getItem('trivial.theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}var r=document.documentElement;r.classList.add(t);r.style.colorScheme=t;var m=document.createElement('meta');m.name='theme-color';m.content=t==='light'?'#eef3f8':'#05070a';document.head.appendChild(m);}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-GB"
      className={`${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

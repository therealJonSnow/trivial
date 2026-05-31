import { defaultCache } from "@serwist/next/worker";
import { Serwist, type PrecacheEntry } from "serwist";

// Serwist injects the precache manifest at this token during the build.
const manifest = (self as unknown as { __SW_MANIFEST: (PrecacheEntry | string)[] })
  .__SW_MANIFEST;

const serwist = new Serwist({
  precacheEntries: manifest,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

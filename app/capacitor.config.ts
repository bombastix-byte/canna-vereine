import type { CapacitorConfig } from '@capacitor/cli';

// Die App ist eine duenne Huelle um die Live-Website des Vereins: Sie laedt
// die Server-App direkt (server.url), dadurch kommen praktisch alle Updates
// weiterhin per Server-Deploy - eine neue APK braucht es nur, wenn sich die
// Huelle selbst aendert (Icon, Berechtigungen, Plugins).
//
// Je Verein steuerbar per Umgebungsvariablen beim Sync/Build:
//   APP_ID     z. B. de.cannaverein.goerlitz
//   APP_NAME   z. B. "CSC Görlitz"
//   APP_URL    z. B. https://goerlitz.89.58.9.0.nip.io
const appUrl = process.env.APP_URL ?? 'https://goerlitz.89.58.9.0.nip.io';

const config: CapacitorConfig = {
  appId: process.env.APP_ID ?? 'de.cannaverein.goerlitz',
  appName: process.env.APP_NAME ?? 'CVMS',
  // webDir ist nur der Offline-Platzhalter; die echte App kommt vom Server.
  webDir: 'www',
  server: {
    url: appUrl,
    // Navigation bleibt innerhalb der Vereins-Domain; externe Links oeffnen
    // im System-Browser.
    allowNavigation: [new URL(appUrl).hostname],
  },
};

export default config;

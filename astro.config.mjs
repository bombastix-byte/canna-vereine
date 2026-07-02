// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// Zwei Bauarten:
//  - Standard (Hybrid): oeffentliche Seiten statisch, /mitglieder/* serverseitig
//    (Node-Adapter). Fuer den echten Betrieb inkl. Mitgliederbereich.
//  - STATIC_ONLY=true: rein statisch, ohne Adapter, ohne Mitglieder-Server.
//    Fuer eine schnelle Online-Demo nur der oeffentlichen Seiten
//    (siehe scripts/build-static.mjs).
const statisch = process.env.STATIC_ONLY === 'true';

// Basis-Pfad fuer Unterverzeichnis-Hosting (z. B. GitHub Project Pages).
// Lokal/eigener Server: '/'. In der GitHub-Action auf '/<repo>/' gesetzt.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: process.env.SITE_URL || 'https://example.de',
  base,
  // Hinter einem TLS-terminierenden Reverse-Proxy (Caddy) sieht der Node-Server
  // die Anfrage als http://, der Browser sendet aber Origin: https:// -> Astros
  // checkOrigin (Standard an) blockt sonst jeden Formular-POST faelschlich mit
  // "Cross-site POST form submissions are forbidden". CSRF-Schutz tragen wir
  // ueber das httpOnly + sameSite=lax Auth-Cookie (wird bei fremd-initiierten
  // POSTs nicht mitgesendet).
  security: { checkOrigin: false },
  ...(statisch ? {} : { adapter: node({ mode: 'standalone' }) }),
});

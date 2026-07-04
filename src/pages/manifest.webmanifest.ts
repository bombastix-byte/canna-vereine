import type { APIRoute } from 'astro';
import { site } from '../config';

// Web-App-Manifest (PWA). Baut den Vereinsnamen aus der SiteConfig ein, damit
// die installierte App je Verein korrekt heisst. Wird beim Build erzeugt.
export const prerender = true;

export const GET: APIRoute = () => {
  // Ohne oeffentlichen Auftritt neutraler App-Name: das Manifest ist oeffentlich
  // abrufbar, und ein generischer Name auf dem Startbildschirm ist fuer
  // Mitglieder ohnehin diskreter (verraet keine Vereinszugehoerigkeit).
  const anonym = site.oeffentlich === false;
  const manifest = {
    name: anonym ? 'Mitgliederbereich' : site.vereinsname,
    short_name: anonym ? 'Mitglieder' : site.kurzname,
    description: anonym ? 'Interner Mitgliederbereich' : `Mitglieder-App der ${site.vereinsname}`,
    lang: 'de',
    start_url: '/mitglieder/bereich',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f5ef',
    theme_color: '#1e3a2c',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Ausgabe', url: '/mitglieder/ausgabe' },
      { name: 'Anbau heute', url: '/mitglieder/anbau' },
      { name: 'Abstimmungen', url: '/mitglieder/abstimmungen' },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8' },
  });
};

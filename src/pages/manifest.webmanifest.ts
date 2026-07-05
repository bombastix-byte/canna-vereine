import type { APIRoute } from 'astro';
import { site, produkt } from '../config';

// Web-App-Manifest (PWA). Wird beim Build erzeugt und ist oeffentlich abrufbar.
export const prerender = true;

export const GET: APIRoute = () => {
  // Interner App-Betrieb (kein oeffentlicher Auftritt): das Manifest zeigt die
  // PRODUKTmarke (CVMS), NICHT den konkreten Verein - so bleibt auf dem
  // Startbildschirm und im oeffentlich abrufbaren Manifest die Vereins-
  // zugehoerigkeit diskret. Oeffentliche Vereinsseiten nennen den Verein.
  const appModus = site.oeffentlich === false;
  const manifest = {
    name: appModus ? produkt.name : site.vereinsname,
    short_name: appModus ? produkt.name : site.kurzname,
    description: appModus ? produkt.lang : `Mitglieder-App der ${site.vereinsname}`,
    lang: 'de',
    // Einstieg ueber die rollengerechte Weiterleitung: /mitglieder schickt
    // angemeldete Mitglieder auf den Ausweis, Personal aufs Dashboard.
    start_url: '/mitglieder',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#232d22',
    theme_color: '#2c3629',
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

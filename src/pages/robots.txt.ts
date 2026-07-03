import type { APIRoute } from 'astro';
import { site } from '../config';

// robots.txt aus der Site-Config: solange `indexierbar` nicht gesetzt ist
// (Entwicklung/Test), wird ALLES fuer Crawler gesperrt. Zusaetzlich traegt
// jede Seite dann noindex/nofollow (Basis-Layout) - doppelter Boden.
export const prerender = true;

export const GET: APIRoute = () => {
  const inhalt = site.indexierbar
    ? 'User-agent: *\nAllow: /\nDisallow: /mitglieder/\n'
    : 'User-agent: *\nDisallow: /\n';
  return new Response(inhalt, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};

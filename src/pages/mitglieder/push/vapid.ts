import type { APIRoute } from 'astro';
import { vapidPublic, pushKonfiguriert } from '../../../lib/push';

// Liefert den oeffentlichen VAPID-Schluessel fuer die Abo-Einrichtung im Browser.
export const prerender = false;

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ konfiguriert: pushKonfiguriert(), key: vapidPublic() }), {
    headers: { 'content-type': 'application/json' },
  });

import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

// Entfernt das eigene Push-Abo (Endpoint). Mitglied kann per Regel nur eigene
// Abos loeschen.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return new Response('anmeldung', { status: 401 });
  const { pb } = ergebnis;

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('json', { status: 400 });
  }
  const endpoint = String(body?.endpoint ?? '').trim();
  if (!endpoint) return new Response('endpoint', { status: 400 });

  try {
    const alt = await pb.collection('push_abos').getFullList({ filter: `endpoint="${endpoint.replaceAll('"', '')}"` });
    for (const a of alt) await pb.collection('push_abos').delete(a.id);
  } catch {
    /* egal - Ziel ist, dass es weg ist */
  }
  return new Response('ok');
};

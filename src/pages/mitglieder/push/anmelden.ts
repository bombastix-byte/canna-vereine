import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

// Speichert ein Push-Abo (vom Browser des Mitglieds). Vorhandenes Abo mit
// gleichem Endpoint wird ersetzt (idempotent). mitglied = angemeldetes Mitglied.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return new Response('anmeldung', { status: 401 });
  const { pb, mitglied } = ergebnis;

  let sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    sub = await request.json();
  } catch {
    return new Response('json', { status: 400 });
  }
  const endpoint = String(sub?.endpoint ?? '').trim();
  if (!endpoint) return new Response('endpoint', { status: 400 });

  try {
    // Vorhandenes Abo mit demselben Endpoint entfernen (Browser neu abonniert).
    const alt = await pb.collection('push_abos').getFullList({ filter: `endpoint="${endpoint.replaceAll('"', '')}"` });
    for (const a of alt) await pb.collection('push_abos').delete(a.id);
    await pb.collection('push_abos').create({
      mitglied: mitglied.id,
      endpoint,
      p256dh: sub?.keys?.p256dh ?? '',
      auth: sub?.keys?.auth ?? '',
    });
  } catch {
    return new Response('fehler', { status: 500 });
  }
  return new Response('ok');
};

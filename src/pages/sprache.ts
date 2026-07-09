import type { APIRoute } from 'astro';
import { spracheAus, SPRACHE_COOKIE } from '../lib/i18n';

// Sprachwahl setzen (Cookie) und zurück zur Ausgangsseite. Bewusst GET,
// damit die Umschalter einfache Links sein können.
export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const zu = spracheAus(url.searchParams.get('zu') ?? '');
  cookies.set(SPRACHE_COOKIE, zu, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  });
  // Nur interne Pfade als Rücksprungziel akzeptieren.
  const zurueck = url.searchParams.get('zurueck') ?? '/mitglieder';
  const ziel = zurueck.startsWith('/') && !zurueck.startsWith('//') ? zurueck : '/mitglieder';
  return redirect(ziel, 303);
};

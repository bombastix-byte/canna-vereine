import type { APIRoute } from 'astro';
import { neuePb, AUTH_COOKIE } from '../../lib/pb';

// Serverseitiger Login-Endpunkt. Authentifiziert gegen PocketBase und legt
// den Token in einem httpOnly-Cookie ab. Keine Anmeldedaten im Browser-JS.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const daten = await request.formData();
  const email = String(daten.get('email') ?? '').trim();
  const passwort = String(daten.get('passwort') ?? '');

  if (!email || !passwort) {
    return redirect('/mitglieder?fehler=fehlend', 303);
  }

  const pb = neuePb();
  try {
    await pb.collection('users').authWithPassword(email, passwort);
  } catch {
    // Bewusst neutrale Meldung, keine Unterscheidung E-Mail/Passwort.
    return redirect('/mitglieder?fehler=ungueltig', 303);
  }

  cookies.set(AUTH_COOKIE, pb.authStore.token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // eine Woche
  });

  return redirect('/mitglieder/bereich', 303);
};

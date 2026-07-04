import type { APIRoute } from 'astro';
import { neuePb, AUTH_COOKIE, PENDING_COOKIE } from '../../lib/pb';
import { alsRollen } from '../../lib/rollen';
import { startseiteFuer } from '../../lib/mitglied-nav';

// Serverseitiger Login-Endpunkt. Authentifiziert gegen PocketBase und legt
// den Token in einem httpOnly-Cookie ab. Keine Anmeldedaten im Browser-JS.
// Hat das Mitglied die Zwei-Faktor-Anmeldung aktiviert, wird der Token erst
// nach dem Code-Schritt (/mitglieder/code) freigegeben - bis dahin liegt er
// in einem kurzlebigen Zwischen-Cookie.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const daten = await request.formData();
  const email = String(daten.get('email') ?? '').trim();
  const passwort = String(daten.get('passwort') ?? '');

  if (!email || !passwort) {
    return redirect('/mitglieder?fehler=fehlend', 303);
  }

  const pb = neuePb();
  let record;
  try {
    ({ record } = await pb.collection('users').authWithPassword(email, passwort));
  } catch {
    // Bewusst neutrale Meldung, keine Unterscheidung E-Mail/Passwort.
    return redirect('/mitglieder?fehler=ungueltig', 303);
  }

  // Zwei-Faktor aktiv? (Der Datensatz ist nur fuer das Mitglied selbst lesbar.)
  let zweifaktorAktiv = false;
  try {
    await pb.collection('zweifaktor').getFirstListItem(`user="${record.id}" && aktiv=true`);
    zweifaktorAktiv = true;
  } catch {
    zweifaktorAktiv = false;
  }

  if (zweifaktorAktiv) {
    cookies.set(PENDING_COOKIE, pb.authStore.token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 5, // 5 Minuten fuer die Code-Eingabe
    });
    return redirect('/mitglieder/code', 303);
  }

  cookies.set(AUTH_COOKIE, pb.authStore.token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // eine Woche
  });

  return redirect(startseiteFuer(alsRollen(record.rollen)), 303);
};

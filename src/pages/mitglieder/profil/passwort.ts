import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

// Eigenes Passwort ändern (altes Passwort verifiziert PocketBase über
// oldPassword). Selbst-Update ist per Collection-Regel erlaubt.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;

  const daten = await request.formData();
  const alt = String(daten.get('alt') ?? '');
  const neu = String(daten.get('neu') ?? '');
  const neu2 = String(daten.get('neu2') ?? '');

  if (!alt || neu.length < 8 || neu !== neu2) {
    return redirect('/mitglieder/profil?fehler=pw', 303);
  }

  try {
    await pb.collection('users').update(mitglied.id, {
      oldPassword: alt,
      password: neu,
      passwordConfirm: neu2,
    });
  } catch {
    return redirect('/mitglieder/profil?fehler=pw', 303);
  }
  return redirect('/mitglieder/profil?ok=pw', 303);
};

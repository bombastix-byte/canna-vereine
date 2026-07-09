import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

// Freiwillige Reset-E-Mail speichern/entfernen. Wird ausschließlich für einen
// späteren Selbst-Passwort-Reset genutzt, nicht als Login-Identität.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;

  const daten = await request.formData();
  const mail = String(daten.get('reset_email') ?? '').trim().toLowerCase();
  // leer = entfernen; sonst grobe Plausibilität.
  if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    return redirect('/mitglieder/profil?fehler=1', 303);
  }
  try {
    await pb.collection('users').update(mitglied.id, { reset_email: mail });
  } catch {
    return redirect('/mitglieder/profil?fehler=1', 303);
  }
  return redirect('/mitglieder/profil?ok=mail', 303);
};

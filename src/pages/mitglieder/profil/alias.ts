import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

// Frei wählbaren Anzeigenamen (Alias) speichern/entfernen. Selbst-Update ist
// per Collection-Regel erlaubt.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;

  const daten = await request.formData();
  const alias = String(daten.get('alias') ?? '').trim().slice(0, 40);
  try {
    await pb.collection('users').update(mitglied.id, { alias });
  } catch {
    return redirect('/mitglieder/profil?fehler=1', 303);
  }
  return redirect('/mitglieder/profil?ok=alias', 303);
};

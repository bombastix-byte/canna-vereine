import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { HINWEIS_VERSION } from '../../../lib/einwilligung';
import { startseiteFuer } from '../../../lib/mitglied-nav';
import { protokolliere } from '../../../lib/audit';

// Mitglied bestätigt die Kenntnisnahme der Präventions-/Gesundheitshinweise
// (§ 23 KCanG). Speichert Version + Zeitpunkt am eigenen Konto (die
// users-updateRule erlaubt Selbst-Updates dieser unkritischen Felder).
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;

  const daten = await request.formData();
  if (daten.get('bestaetigt') !== 'on' && daten.get('bestaetigt') !== '1') {
    return redirect('/mitglieder/hinweise?fehler=1', 303);
  }

  // Zeitstempel als ISO (Sekundengenau reicht als Nachweis).
  const jetzt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  try {
    await pb.collection('users').update(mitglied.id, {
      hinweise_version: HINWEIS_VERSION,
      hinweise_bestaetigt_am: jetzt,
    });
  } catch {
    return redirect('/mitglieder/hinweise?fehler=1', 303);
  }

  await protokolliere(pb, mitglied, 'hinweise.bestaetigt', {
    objektTyp: 'mitglied', objektId: mitglied.id,
    objektLabel: `${mitglied.mitgliedsnummer || ''} ${mitglied.name || ''}`.trim(),
    details: `Version ${HINWEIS_VERSION}`,
  });

  return redirect(startseiteFuer(mitglied.rollen), 303);
};

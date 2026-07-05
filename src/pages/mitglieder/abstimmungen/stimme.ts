import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { hatAbstimmungen } from '../../../lib/funktionen';
import { berlinTag } from '../../../lib/ausgabe';

// Gibt die Stimme des angemeldeten Mitglieds ab. Eine Stimme je Abstimmung
// (auf DB-Ebene per Unique-Index garantiert). Nur bei offener Abstimmung.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!hatAbstimmungen) return redirect('/mitglieder/bereich', 303);

  const daten = await request.formData();
  const abstimmungId = String(daten.get('abstimmung') ?? '').trim();
  const optionIndex = Number(String(daten.get('option_index') ?? '').trim());
  const zurueck = (q: string) => redirect(`/mitglieder/abstimmungen?${q}#a-${abstimmungId}`, 303);

  if (!abstimmungId || !Number.isInteger(optionIndex)) return zurueck('fehler=fehlend');

  let abstimmung;
  try {
    abstimmung = await pb.collection('abstimmungen').getOne(abstimmungId);
  } catch {
    return zurueck('fehler=fehlgeschlagen');
  }

  if (abstimmung.status !== 'offen') return zurueck('fehler=geschlossen');
  if (abstimmung.ende && String(abstimmung.ende).slice(0, 10) < berlinTag()) return zurueck('fehler=geschlossen');
  const optionen = Array.isArray(abstimmung.optionen) ? abstimmung.optionen : [];
  if (optionIndex < 0 || optionIndex >= optionen.length) return zurueck('fehler=fehlend');

  try {
    await pb.collection('stimmen').create({
      abstimmung: abstimmungId,
      mitglied: mitglied.id,
      option_index: optionIndex,
    });
  } catch {
    // Unique-Index bricht eine zweite Stimme ab -> bereits abgestimmt.
    return zurueck('fehler=schon');
  }

  return zurueck('ok=1');
};

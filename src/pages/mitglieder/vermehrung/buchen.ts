import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAusgeben } from '../../../lib/rollen';
import { berlinTag, berlinMonat } from '../../../lib/ausgabe';
import { pruefeVermehrung, summeStueck } from '../../../lib/vermehrung';

// Bucht die Weitergabe von Vermehrungsmaterial (Samen/Stecklinge) an ein
// Mitglied. Prueft die Monatsgrenze (7 Samen / 5 Stecklinge). Nur Personal.
export const prerender = false;

function zurueck(redirect: (u: string, s?: number) => Response, mitgliedId: string, meldung: string) {
  const q = new URLSearchParams({ mitglied: mitgliedId, fehler: '1', msg: meldung });
  return redirect(`/mitglieder/vermehrung?${q.toString()}`, 303);
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied: personal } = ergebnis;
  if (!darfAusgeben(personal.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const mitgliedId = String(daten.get('mitglied') ?? '').trim();
  const art = String(daten.get('art') ?? '').trim();
  const anzahl = Number(String(daten.get('anzahl') ?? '').trim());

  if (!mitgliedId || !art) return zurueck(redirect, mitgliedId, 'Bitte Mitglied und Art auswaehlen.');

  let empfaenger;
  try {
    empfaenger = await pb.collection('users').getOne(mitgliedId);
  } catch {
    return zurueck(redirect, mitgliedId, 'Mitglied nicht gefunden.');
  }

  const tag = berlinTag();
  const monat = berlinMonat(tag);

  let bisher = [];
  try {
    bisher = await pb.collection('vermehrung_ausgaben').getFullList({
      filter: `mitglied="${mitgliedId}" && monat="${monat}" && art="${art}"`,
    });
  } catch {
    bisher = [];
  }

  const pruefung = pruefeVermehrung({ art, bisherMonat: summeStueck(bisher), anzahlNeu: anzahl });
  if (!pruefung.ok) return zurueck(redirect, mitgliedId, pruefung.meldung ?? 'Nicht zulaessig.');

  try {
    await pb.collection('vermehrung_ausgaben').create({
      mitglied: mitgliedId,
      mitgliedsnummer: empfaenger.mitgliedsnummer || '',
      art,
      anzahl,
      tag,
      monat,
      abgegeben_von: personal.id,
      belegnr: 'V-' + tag.replaceAll('-', '') + '-' + String(Date.now()).slice(-5),
      notiz: '',
    });
  } catch {
    return zurueck(redirect, mitgliedId, 'Buchung fehlgeschlagen.');
  }

  const q = new URLSearchParams({ mitglied: mitgliedId, ok: '1' });
  return redirect(`/mitglieder/vermehrung?${q.toString()}`, 303);
};

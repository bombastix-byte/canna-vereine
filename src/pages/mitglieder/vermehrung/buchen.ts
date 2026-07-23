import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAusgeben } from '../../../lib/rollen';
import { berlinTag, berlinMonat } from '../../../lib/ausgabe';
import { pruefeVermehrung, summeStueck, ART_LABEL } from '../../../lib/vermehrung';
import { inReihe } from '../../../lib/serie';

// Bucht die Weitergabe von Vermehrungsmaterial an ein Mitglied. Samen und
// Stecklinge koennen in EINEM Vorgang zusammen gebucht werden (je Art eigene
// Monatsgrenze: 7 Samen / 5 Stecklinge). Beide Grenzen werden VOR dem Anlegen
// geprueft, damit nie nur die halbe Buchung durchgeht. Nur Personal.
export const prerender = false;

// Die Vermehrung ist Teil der Tresen-Seite (/mitglieder/ausgabe).
function zurueck(redirect: (u: string, s?: 303) => Response, mitgliedId: string, meldung: string) {
  const q = new URLSearchParams({ mitglied: mitgliedId, fehler: '1', msg: meldung });
  return redirect(`/mitglieder/ausgabe?${q.toString()}`, 303);
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied: personal } = ergebnis;
  if (!darfAusgeben(personal.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const mitgliedId = String(daten.get('mitglied') ?? '').trim();
  if (!mitgliedId) return zurueck(redirect, mitgliedId, 'Bitte zuerst ein Mitglied waehlen.');

  // Neue Doppel-Felder; die alten Einzelfelder (art + anzahl) bleiben gueltig.
  const posten: Array<{ art: string; anzahl: number }> = [];
  const altArt = String(daten.get('art') ?? '').trim();
  const altAnzahl = Number(String(daten.get('anzahl') ?? '').trim());
  if (altArt && Number.isFinite(altAnzahl) && altAnzahl > 0) posten.push({ art: altArt, anzahl: altAnzahl });
  for (const art of ['samen', 'stecklinge']) {
    const n = Number(String(daten.get(`anzahl_${art}`) ?? '').trim());
    if (Number.isFinite(n) && n > 0) posten.push({ art, anzahl: n });
  }
  if (posten.length === 0) {
    return zurueck(redirect, mitgliedId, 'Bitte mindestens eine Stueckzahl angeben (Samen oder Stecklinge).');
  }

  let empfaenger;
  try {
    empfaenger = await pb.collection('users').getOne(mitgliedId);
  } catch {
    return zurueck(redirect, mitgliedId, 'Mitglied nicht gefunden.');
  }

  // T5 (fixt F4-Szenario A im Normalbetrieb): Pruef+Buchungsblock je
  // Mitglied serialisieren (siehe ausgabe/buchen.ts fuer Details).
  return inReihe(mitgliedId, async () => {
    const tag = berlinTag();
    const monat = berlinMonat(tag);

    // ERST beide Grenzen pruefen, DANN buchen (keine halben Vorgaenge).
    for (const p of posten) {
      let bisher: Array<Record<string, any>>;
      try {
        bisher = await pb.collection('vermehrung_ausgaben').getFullList({
          filter: `mitglied="${mitgliedId}" && monat="${monat}" && art="${p.art}"`,
        });
      } catch {
        // Fail-closed (T3, fixt F5): siehe buchen.ts - bei Fehler abbrechen
        // statt mit leerer Liste gegen 0 zu pruefen.
        return zurueck(redirect, mitgliedId, 'Limit-Prüfung nicht möglich - Weitergabe abgebrochen.');
      }
      const pruefung = pruefeVermehrung({ art: p.art, bisherMonat: summeStueck(bisher), anzahlNeu: p.anzahl });
      if (!pruefung.ok) {
        return zurueck(redirect, mitgliedId, `${ART_LABEL[p.art as keyof typeof ART_LABEL] ?? p.art}: ${pruefung.meldung ?? 'nicht zulaessig.'} Es wurde nichts gebucht.`);
      }
    }

    const belegnr = 'V-' + tag.replaceAll('-', '') + '-' + String(Date.now()).slice(-5);
    let gebucht = 0;
    for (const p of posten) {
      try {
        await pb.collection('vermehrung_ausgaben').create({
          mitglied: mitgliedId,
          mitgliedsnummer: empfaenger.mitgliedsnummer || '',
          art: p.art,
          anzahl: p.anzahl,
          tag,
          monat,
          abgegeben_von: personal.id,
          belegnr,
          notiz: '',
        });
        gebucht++;
      } catch {
        return zurueck(
          redirect,
          mitgliedId,
          gebucht
            ? `Nur ${gebucht} von ${posten.length} Posten gebucht (Beleg ${belegnr}) - Rest bitte erneut buchen.`
            : 'Buchung fehlgeschlagen.',
        );
      }
    }

    const q = new URLSearchParams({ mitglied: mitgliedId, ok: 'vermehrung' });
    return redirect(`/mitglieder/ausgabe?${q.toString()}`, 303);
  });
};

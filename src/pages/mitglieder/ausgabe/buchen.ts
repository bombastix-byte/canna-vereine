import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAusgeben } from '../../../lib/rollen';
import {
  berlinTag,
  berlinMonat,
  istU21,
  pruefeLimit,
  beitragEuro,
  summeGramm,
} from '../../../lib/ausgabe';

// Bucht eine Abgabe am Tresen. Nur Personal (Ausgabe/Vorstand). Gebucht wird auf
// eine konkrete, freigegebene CHARGE - so ist jede Abgabe bis zum Anbaulos
// rueckverfolgbar und der THC-Wert stammt aus der Messung genau dieser Charge.
// Die gesetzliche Pruefung passiert hier serverseitig, bevor gebucht wird.
export const prerender = false;

function zurueck(redirect: (u: string, s?: number) => Response, mitgliedId: string, meldung: string) {
  const q = new URLSearchParams({ mitglied: mitgliedId, fehler: '1', msg: meldung });
  return redirect(`/mitglieder/ausgabe?${q.toString()}`, 303);
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied: personal } = ergebnis;
  if (!darfAusgeben(personal.rollen)) {
    return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);
  }

  const daten = await request.formData();
  const mitgliedId = String(daten.get('mitglied') ?? '').trim();
  const chargeId = String(daten.get('charge') ?? '').trim();
  const menge = Number(String(daten.get('menge_gramm') ?? '').trim());

  if (!mitgliedId || !chargeId) {
    return zurueck(redirect, mitgliedId, 'Bitte Mitglied und Charge auswaehlen.');
  }
  if (!Number.isFinite(menge) || menge <= 0) {
    return zurueck(redirect, mitgliedId, 'Bitte eine gueltige Menge in Gramm angeben.');
  }

  let empfaenger;
  let charge;
  try {
    empfaenger = await pb.collection('users').getOne(mitgliedId);
    charge = await pb.collection('chargen').getOne(chargeId);
  } catch {
    return zurueck(redirect, mitgliedId, 'Mitglied oder Charge nicht gefunden.');
  }

  if (charge.status !== 'freigegeben') {
    return zurueck(redirect, mitgliedId, 'Diese Charge ist nicht zur Abgabe freigegeben.');
  }

  const tag = berlinTag();
  const monat = berlinMonat(tag);

  // Bereits gebuchte Mengen dieses Mitglieds im laufenden Monat (Tag = Teilmenge).
  let monatsSaetze = [];
  try {
    monatsSaetze = await pb.collection('ausgaben').getFullList({
      filter: `mitglied="${mitgliedId}" && monat="${monat}"`,
    });
  } catch {
    monatsSaetze = [];
  }
  const mengeMonatBisher = summeGramm(monatsSaetze);
  const mengeHeuteBisher = summeGramm(monatsSaetze.filter((r) => r.tag === tag));

  const thcRoh = Number(charge.thc_prozent);
  const thcProzent = Number.isFinite(thcRoh) && thcRoh > 0 ? thcRoh : null;
  const geburtsdatum = empfaenger.geburtsdatum || undefined;

  const pruefung = pruefeLimit({
    u21: istU21(geburtsdatum, tag),
    alterBekannt: !!geburtsdatum,
    thcProzent,
    mengeHeuteBisher,
    mengeMonatBisher,
    mengeNeu: menge,
    bestandGramm: charge.verfuegbar_g != null ? Number(charge.verfuegbar_g) : null,
  });

  if (!pruefung.ok) {
    return zurueck(redirect, mitgliedId, pruefung.meldung ?? 'Abgabe nicht zulaessig.');
  }

  const belegnr = 'A-' + tag.replaceAll('-', '') + '-' + String(Date.now()).slice(-5);

  let neu;
  try {
    neu = await pb.collection('ausgaben').create({
      mitglied: mitgliedId,
      mitgliedsnummer: empfaenger.mitgliedsnummer || '',
      charge_ref: chargeId,
      charge: charge.charge_nr || '',
      sorte: charge.sorte || null,
      sorte_name: charge.sorte_name || '',
      thc_prozent: thcProzent ?? 0,
      cbd_prozent: charge.cbd_prozent != null ? Number(charge.cbd_prozent) : 0,
      menge_gramm: menge,
      beitrag_euro: beitragEuro(menge),
      tag,
      monat,
      abgegeben_von: personal.id,
      belegnr,
      notiz: '',
    });
  } catch {
    return zurueck(redirect, mitgliedId, 'Buchung fehlgeschlagen. Bitte erneut versuchen.');
  }

  // Bestand der Charge fortschreiben (best-effort; die Abgabe ist schon gebucht).
  if (charge.verfuegbar_g != null) {
    try {
      const rest = Math.max(0, Number(charge.verfuegbar_g) - menge);
      const patch: Record<string, unknown> = { verfuegbar_g: rest };
      if (rest === 0) patch.status = 'aufgebraucht';
      await pb.collection('chargen').update(chargeId, patch);
    } catch {
      // Bestand konnte nicht aktualisiert werden - Abgabe bleibt gueltig,
      // Anbauverantwortliche korrigieren im CMS/der Warenwirtschaft.
    }
  }

  return redirect(`/mitglieder/ausgabe/beleg/${neu.id}?neu=1`, 303);
};

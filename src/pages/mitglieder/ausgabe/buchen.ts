import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAusgeben } from '../../../lib/rollen';
import {
  berlinTag,
  berlinMonat,
  istU21,
  pruefeAbgabePositionen,
  beitragEuro,
  summeGramm,
} from '../../../lib/ausgabe';

// Bucht eine Abgabe am Tresen - EIN Vorgang mit einer oder MEHREREN Positionen
// (Mitglied nimmt mehrere Sorten mit). Alle Positionen teilen sich eine
// Belegnummer -> ein gemeinsamer Beleg. Die gesetzliche Pruefung laeuft ueber
// die SUMME aller Positionen (Tages-/Monatslimit), U21-THC und Bestand je
// Position. Nur Personal (Ausgabe/Vorstand).
export const prerender = false;

const MAX_POSITIONEN = 10;

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
  if (!mitgliedId) return zurueck(redirect, mitgliedId, 'Bitte zuerst ein Mitglied waehlen.');

  // Positionen einsammeln: charge_1..N / menge_1..N, dazu die alten
  // Einzelfelder charge/menge_gramm (Abwaertskompatibilitaet).
  const roh: Array<{ chargeId: string; menge: number }> = [];
  const lies = (c: unknown, m: unknown) => {
    const chargeId = String(c ?? '').trim();
    const mengeStr = String(m ?? '').trim();
    if (!chargeId && !mengeStr) return; // leere Zeile, ok
    const menge = Number(mengeStr.replace(',', '.'));
    roh.push({ chargeId, menge });
  };
  lies(daten.get('charge'), daten.get('menge_gramm'));
  for (let i = 1; i <= MAX_POSITIONEN; i++) {
    lies(daten.get(`charge_${i}`), daten.get(`menge_${i}`));
  }

  if (roh.length === 0) return zurueck(redirect, mitgliedId, 'Bitte mindestens eine Sorte mit Menge angeben.');
  if (roh.some((p) => !p.chargeId)) return zurueck(redirect, mitgliedId, 'Bei einer Position fehlt die Sorte.');
  if (roh.some((p) => !Number.isFinite(p.menge) || p.menge <= 0)) {
    return zurueck(redirect, mitgliedId, 'Bitte fuer jede Position eine gueltige Menge in Gramm angeben.');
  }

  // Doppelt gewaehlte Charge zu einer Position zusammenfassen (freundlicher
  // als ein Fehler; Limit-/Bestandspruefung stimmt so weiterhin).
  const jeCharge = new Map<string, number>();
  for (const p of roh) jeCharge.set(p.chargeId, (jeCharge.get(p.chargeId) ?? 0) + p.menge);

  let empfaenger;
  try {
    empfaenger = await pb.collection('users').getOne(mitgliedId);
  } catch {
    return zurueck(redirect, mitgliedId, 'Mitglied nicht gefunden.');
  }

  const chargen: Array<{ charge: Record<string, any>; menge: number }> = [];
  for (const [chargeId, menge] of jeCharge) {
    let charge;
    try {
      charge = await pb.collection('chargen').getOne(chargeId);
    } catch {
      return zurueck(redirect, mitgliedId, 'Eine gewaehlte Charge wurde nicht gefunden.');
    }
    if (charge.status !== 'freigegeben') {
      return zurueck(redirect, mitgliedId, `Charge ${charge.charge_nr ?? ''} ist nicht zur Abgabe freigegeben.`);
    }
    chargen.push({ charge, menge });
  }

  const tag = berlinTag();
  const monat = berlinMonat(tag);

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
  const geburtsdatum = empfaenger.geburtsdatum || undefined;

  const thcVon = (c: Record<string, any>) => {
    const roh = Number(c.thc_prozent);
    return Number.isFinite(roh) && roh > 0 ? roh : null;
  };

  const pruefung = pruefeAbgabePositionen({
    u21: istU21(geburtsdatum, tag),
    alterBekannt: !!geburtsdatum,
    mengeHeuteBisher,
    mengeMonatBisher,
    positionen: chargen.map(({ charge, menge }) => ({
      thcProzent: thcVon(charge),
      menge,
      bestandGramm: charge.verfuegbar_g != null ? Number(charge.verfuegbar_g) : null,
      name: `${charge.sorte_name ?? ''} ${charge.charge_nr ?? ''}`.trim(),
    })),
  });
  if (!pruefung.ok) {
    return zurueck(redirect, mitgliedId, pruefung.meldung ?? 'Abgabe nicht zulaessig.');
  }

  // Gemeinsame Belegnummer fuer alle Positionen dieses Vorgangs.
  const belegnr = 'A-' + tag.replaceAll('-', '') + '-' + String(Date.now()).slice(-5);

  let erster: Record<string, any> | null = null;
  const gebucht: Array<{ charge: Record<string, any>; menge: number }> = [];
  for (const { charge, menge } of chargen) {
    try {
      const neu = await pb.collection('ausgaben').create({
        mitglied: mitgliedId,
        mitgliedsnummer: empfaenger.mitgliedsnummer || '',
        charge_ref: charge.id,
        charge: charge.charge_nr || '',
        sorte: charge.sorte || null,
        sorte_name: charge.sorte_name || '',
        thc_prozent: thcVon(charge) ?? 0,
        cbd_prozent: charge.cbd_prozent != null ? Number(charge.cbd_prozent) : 0,
        menge_gramm: menge,
        beitrag_euro: beitragEuro(menge),
        tag,
        monat,
        abgegeben_von: personal.id,
        belegnr,
        notiz: '',
      });
      if (!erster) erster = neu;
      gebucht.push({ charge, menge });
    } catch {
      // Teilweise gebucht: bereits angelegte Positionen bleiben gueltig
      // (append-only Protokoll), die Meldung macht den Zustand transparent.
      return zurueck(
        redirect,
        mitgliedId,
        gebucht.length
          ? `Nur ${gebucht.length} von ${chargen.length} Positionen gebucht (Beleg ${belegnr}) - Rest bitte erneut buchen.`
          : 'Buchung fehlgeschlagen. Bitte erneut versuchen.',
      );
    }
  }

  // Bestaende fortschreiben (best-effort; die Abgaben sind bereits gebucht).
  for (const { charge, menge } of gebucht) {
    if (charge.verfuegbar_g == null) continue;
    try {
      const rest = Math.max(0, Number(charge.verfuegbar_g) - menge);
      const patch: Record<string, unknown> = { verfuegbar_g: rest };
      if (rest === 0) patch.status = 'aufgebraucht';
      await pb.collection('chargen').update(charge.id, patch);
    } catch {
      // Bestand korrigieren Anbau/Vorstand im CMS bzw. der Warenwirtschaft.
    }
  }

  return redirect(`/mitglieder/ausgabe/beleg/${erster!.id}?neu=1`, 303);
};

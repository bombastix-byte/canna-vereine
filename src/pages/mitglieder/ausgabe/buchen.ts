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
import { produktTyp } from '../../../lib/verarbeitung';
import { abgabeErlaubt, abgabeSperrGrund } from '../../../lib/status';
import { erfasseVorgang } from '../../../lib/kassen-konnektor';
import { inReihe } from '../../../lib/serie';

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

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
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

  // Lebenszyklus: ruhende/ausgetretene Mitglieder erhalten keine Abgabe.
  if (!abgabeErlaubt(empfaenger, berlinTag())) {
    const grund = abgabeSperrGrund(empfaenger, berlinTag());
    return zurueck(redirect, mitgliedId, `Abgabe nicht möglich: ${grund}. Bitte an den Vorstand wenden.`);
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

  // T5 (fixt F4-Szenario A im Normalbetrieb): ab hier je Mitglied seriali-
  // sieren, damit zwei quasi-gleichzeitige Buchungen fuer DASSELBE Mitglied
  // nicht beide auf denselben (veralteten) Limit-Stand pruefen. Schutz gilt
  // je Node-Prozess (@astrojs/node laeuft als Einzelprozess); bei Multi-
  // Instanz-Betrieb ist der PB-Hook (T6, pb/pb_hooks/ausgaben.pb.js) die
  // autoritative Grenze.
  return inReihe(mitgliedId, async () => {
    const tag = berlinTag();
    const monat = berlinMonat(tag);

    let monatsSaetze: Array<Record<string, any>>;
    try {
      monatsSaetze = await pb.collection('ausgaben').getFullList({
        filter: `mitglied="${mitgliedId}" && monat="${monat}" && storniert!=true`,
      });
    } catch {
      // Fail-closed (T3, fixt F5): bei Fehler NICHT mit leerer Liste weiter-
      // pruefen (sonst wuerden Limits faelschlich gegen 0 geprueft) - die
      // Abgabe wird abgebrochen.
      return zurueck(redirect, mitgliedId, 'Limit-Prüfung nicht möglich (Datenbank nicht erreichbar) - Abgabe abgebrochen.');
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

    // Barvorgang je nach tatsaechlich gebuchten Positionen erfassen - wird aus
    // BEIDEN Pfaden (voll gebucht / nur teilweise gebucht) aufgerufen, damit
    // die Kasse nie hinter den bereits angelegten Abgaben zurueckbleibt (T4,
    // fixt F10).
    const verbucheKasse = async (posten: Array<{ charge: Record<string, any>; menge: number }>) => {
      if (posten.length === 0) return;
      const positionen = posten.map(({ charge, menge }) => ({
        bezeichnung: `${charge.sorte_name ?? ''} ${charge.charge_nr ?? ''}`.trim(),
        menge_g: menge,
        betrag_euro: beitragEuro(menge),
      }));
      const beitragGesamt = positionen.reduce((s, p) => s + p.betrag_euro, 0);
      await erfasseVorgang(pb, locals.kasseExtern, {
        art: 'abgabe',
        belegnr,
        mitglied: mitgliedId,
        mitgliedsnummer: empfaenger.mitgliedsnummer || '',
        betrag_euro: Math.round(beitragGesamt * 100) / 100,
        datum: tag,
        positionen,
      }, personal.id);
    };

    let erster: Record<string, any> | null = null;
    const gebucht: Array<{ charge: Record<string, any>; menge: number }> = [];
    let bestandWarnung = false;
    for (const { charge, menge } of chargen) {
      let neu: Record<string, any>;
      try {
        neu = await pb.collection('ausgaben').create({
          mitglied: mitgliedId,
          mitgliedsnummer: empfaenger.mitgliedsnummer || '',
          charge_ref: charge.id,
          charge: charge.charge_nr || '',
          sorte: charge.sorte || null,
          sorte_name: charge.sorte_name || '',
          produkt_typ: produktTyp(charge.produkt_typ),
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
      } catch {
        // Teilweise gebucht: bereits angelegte Positionen bleiben gueltig
        // (append-only Protokoll), die Meldung macht den Zustand transparent.
        // Kasse trotzdem fuer die bereits gebuchten Positionen nachziehen.
        await verbucheKasse(gebucht);
        return zurueck(
          redirect,
          mitgliedId,
          gebucht.length
            ? `Nur ${gebucht.length} von ${chargen.length} Positionen gebucht (Beleg ${belegnr}) - Rest bitte erneut buchen.`
            : 'Buchung fehlgeschlagen. Bitte erneut versuchen.',
        );
      }
      if (!erster) erster = neu;
      gebucht.push({ charge, menge });

      // T4 (fixt F4-Szenario B): Bestandsabzug DIREKT nach dem Create dieser
      // Position, per PB-Feld-Modifier "verfuegbar_g-". WICHTIG (Erkenntnis
      // aus der E2E-Verifikation, ueber den Spec-Wortlaut hinaus): der PB-
      // Feld-Modifier rechnet zwar serverseitig, ist aber in der getesteten
      // PocketBase-Version (0.39) bei ECHT gleichzeitigen Requests auf
      // DENSELBEN Datensatz NICHT verlustfrei (beobachtet: von 10 parallelen
      // "-1"-Aufrufen auf einen Startwert 100 kamen wiederholt nur 6-8 an,
      // nicht 10 - klassisches Lost-Update trotz Modifier-Syntax). Deshalb
      // zusaetzlich per Charge serialisiert (inReihe, gleiches Prinzip wie
      // T5 je Mitglied) - das schliesst die Luecke fuer den Normalbetrieb
      // (Einzelprozess); bei Multi-Instanz-Betrieb bleibt das Restrisiko
      // bestehen (dort waere eine SQL-Transaktion im PB-Hook noetig).
      // Ein rechnerisch negativer Bestand wird NICHT auf 0 geklemmt (ehrlicher
      // Zaehlstand), sondern als Warnung markiert.
      if (charge.verfuegbar_g != null) {
        try {
          const aktualisiert = await inReihe(`charge:${charge.id}`, () =>
            pb.collection('chargen').update(charge.id, { 'verfuegbar_g-': menge }),
          );
          const rest = Number(aktualisiert.verfuegbar_g);
          if (rest < 0) bestandWarnung = true;
          if (rest <= 0 && aktualisiert.status !== 'aufgebraucht') {
            await pb.collection('chargen').update(charge.id, { status: 'aufgebraucht' });
          }
        } catch {
          // Bestand ggf. von Hand korrigieren (Anbau/Vorstand im CMS bzw. der
          // Warenwirtschaft) - die Abgabe selbst ist bereits gebucht.
        }
      }
    }

    // Kasse fuer den vollstaendig gebuchten Vorgang erfassen.
    await verbucheKasse(gebucht);

    const warnung = bestandWarnung
      ? '&warnung=' + encodeURIComponent('Bestand rechnerisch negativ - bitte Warenwirtschaft prüfen.')
      : '';
    return redirect(`/mitglieder/ausgabe/beleg/${erster!.id}?neu=1${warnung}`, 303);
  });
};

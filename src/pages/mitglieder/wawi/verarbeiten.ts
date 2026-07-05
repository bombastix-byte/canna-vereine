import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';
import { chargeNr } from '../../../lib/wawi';
import { pruefeVerarbeitungMulti, verteileErtrag, produktTyp, produktLabel } from '../../../lib/verarbeitung';
import { berlinTag } from '../../../lib/ausgabe';

// Weiterverarbeitung buchen: aus EINER ODER MEHREREN freigegebenen Blueten-
// Chargen wird Haschisch oder Rosin (In-Haus-Mix). Aus jeder Quelle wird der
// Einsatz abgezogen; das Produkt ist eine NEUE freigegebene Charge. Je Quelle
// ein Protokoll-Eintrag (Ertrag proportional verteilt) fuer die Rueckverfolgung
// und die Jahresmeldung. Nur Anbau/Vorstand.
export const prerender = false;

const MAX_QUELLEN = 6;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const typ = String(daten.get('produkt_typ') ?? '').trim();
  const bezeichnung = String(daten.get('bezeichnung') ?? '').trim();
  const ertrag = Number(String(daten.get('ertrag_g') ?? '').replace(',', '.'));
  const thc = Number(String(daten.get('thc_prozent') ?? '').replace(',', '.'));
  const cbd = Number(String(daten.get('cbd_prozent') ?? '').replace(',', '.'));
  const notiz = String(daten.get('notiz') ?? '').trim();

  const fehler = (msg: string) => {
    const q = new URLSearchParams({ fehler: 'verarbeitung', msg });
    return redirect(`/mitglieder/wawi?${q.toString()}`, 303);
  };

  // Quellen einsammeln: quelle_1..N + einsatz_1..N, dazu die alten Einzelfelder
  // quelle/einsatz_g (Abwaertskompatibilitaet).
  const roh: Array<{ id: string; einsatz: number }> = [];
  const lies = (id: unknown, e: unknown) => {
    const cid = String(id ?? '').trim();
    if (!cid) return;
    roh.push({ id: cid, einsatz: Number(String(e ?? '').replace(',', '.')) });
  };
  lies(daten.get('quelle'), daten.get('einsatz_g'));
  for (let i = 1; i <= MAX_QUELLEN; i++) lies(daten.get(`quelle_${i}`), daten.get(`einsatz_${i}`));

  if (roh.length === 0) return fehler('Bitte mindestens eine Blueten-Charge als Quelle waehlen.');
  // Dieselbe Charge doppelt gewaehlt -> Einsaetze zusammenfassen.
  const jeCharge = new Map<string, number>();
  for (const r of roh) jeCharge.set(r.id, (jeCharge.get(r.id) ?? 0) + (Number.isFinite(r.einsatz) ? r.einsatz : NaN));

  // Chargen laden.
  const quellen: Array<{ charge: Record<string, any>; einsatz: number }> = [];
  for (const [id, einsatz] of jeCharge) {
    let charge;
    try {
      charge = await pb.collection('chargen').getOne(id);
    } catch {
      return fehler('Eine gewaehlte Quell-Charge wurde nicht gefunden.');
    }
    quellen.push({ charge, einsatz });
  }

  const pruefung = pruefeVerarbeitungMulti({
    typ,
    ertragG: ertrag,
    quellen: quellen.map(({ charge, einsatz }) => ({
      einsatzG: einsatz,
      verfuegbarG: charge.verfuegbar_g != null ? Number(charge.verfuegbar_g) : null,
      typ: charge.produkt_typ,
      status: charge.status,
    })),
  });
  if (!pruefung.ok) return fehler(pruefung.meldung ?? 'Verarbeitung nicht moeglich.');

  const tag = berlinTag();
  const jahr = tag.slice(0, 4);
  const mix = quellen.length > 1;
  const anteile = verteileErtrag(quellen.map((q) => q.einsatz), ertrag);

  // Anzeigename: freie Bezeichnung, sonst bei Einzelquelle der Sortenname,
  // bei Mix ein sprechender Sammelname.
  const produktName =
    bezeichnung ||
    (mix ? `${produktLabel(typ)} Mix` : quellen[0].charge.sorte_name || produktLabel(typ));
  const quellNummern = quellen.map((q) => q.charge.charge_nr).filter(Boolean).join(', ');

  try {
    const anzahl = (await pb.collection('chargen').getList(1, 1, { filter: `charge_nr~"${jahr}-"` })).totalItems;
    const produkt = await pb.collection('chargen').create({
      charge_nr: chargeNr(jahr, anzahl),
      // Einzelquelle behaelt die Sorten-Referenz (Rueckverfolgung); Mix hat keine.
      sorte: mix ? null : quellen[0].charge.sorte || null,
      sorte_name: produktName,
      status: 'freigegeben',
      produkt_typ: produktTyp(typ),
      herkunft: `Verarbeitung aus Charge${quellen.length > 1 ? 'n' : ''} ${quellNummern}`,
      trockengewicht_g: ertrag,
      verfuegbar_g: ertrag,
      thc_prozent: Number.isFinite(thc) && thc > 0 ? thc : null,
      cbd_prozent: Number.isFinite(cbd) && cbd >= 0 ? cbd : null,
      notiz,
    });

    // Je Quelle: Protokoll-Eintrag (Ertrag proportional) + Bestand abziehen.
    for (let i = 0; i < quellen.length; i++) {
      const { charge, einsatz } = quellen[i];
      await pb.collection('verarbeitungen').create({
        quelle_ref: charge.id,
        quelle_nr: charge.charge_nr || '',
        sorte_name: charge.sorte_name || '',
        produkt_typ: produktTyp(typ),
        einsatz_g: einsatz,
        ertrag_g: anteile[i],
        produkt_ref: produkt.id,
        produkt_nr: produkt.charge_nr,
        datum: tag,
        durchgefuehrt_von: mitglied.id,
        notiz: mix ? `Mix -> ${produkt.charge_nr}${notiz ? ' · ' + notiz : ''}` : notiz,
      });
      const rest = Math.max(0, Number(charge.verfuegbar_g) - einsatz);
      const patch: Record<string, unknown> = { verfuegbar_g: rest };
      if (rest === 0) patch.status = 'aufgebraucht';
      await pb.collection('chargen').update(charge.id, patch);
    }
  } catch {
    return redirect('/mitglieder/wawi?fehler=fehlgeschlagen', 303);
  }

  return redirect('/mitglieder/wawi?ok=verarbeitet', 303);
};

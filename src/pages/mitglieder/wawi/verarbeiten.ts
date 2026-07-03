import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';
import { chargeNr } from '../../../lib/wawi';
import { pruefeVerarbeitung, produktTyp } from '../../../lib/verarbeitung';
import { berlinTag } from '../../../lib/ausgabe';

// Weiterverarbeitung buchen: aus einer freigegebenen Blueten-Charge wird
// Haschisch oder Rosin. Das Produkt ist eine NEUE Charge (sofort freigegeben,
// mit eigenem THC/CBD) - damit greifen am Tresen Limits, U21-Sperre und
// Rueckverfolgung unveraendert. Der Vorgang selbst steht append-only im
// Protokoll `verarbeitungen`. Nur Anbau/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const quelleId = String(daten.get('quelle') ?? '').trim();
  const typ = String(daten.get('produkt_typ') ?? '').trim();
  const einsatz = Number(String(daten.get('einsatz_g') ?? '').replace(',', '.'));
  const ertrag = Number(String(daten.get('ertrag_g') ?? '').replace(',', '.'));
  const thc = Number(String(daten.get('thc_prozent') ?? '').replace(',', '.'));
  const cbd = Number(String(daten.get('cbd_prozent') ?? '').replace(',', '.'));
  const notiz = String(daten.get('notiz') ?? '').trim();

  if (!quelleId) return redirect('/mitglieder/wawi?fehler=fehlend', 303);

  let quelle;
  try {
    quelle = await pb.collection('chargen').getOne(quelleId);
  } catch {
    return redirect('/mitglieder/wawi?fehler=fehlgeschlagen', 303);
  }

  const pruefung = pruefeVerarbeitung({
    typ,
    einsatzG: einsatz,
    ertragG: ertrag,
    verfuegbarG: quelle.verfuegbar_g != null ? Number(quelle.verfuegbar_g) : null,
    quelleTyp: quelle.produkt_typ,
    quelleStatus: quelle.status,
  });
  if (!pruefung.ok) {
    const q = new URLSearchParams({ fehler: 'verarbeitung', msg: pruefung.meldung ?? '' });
    return redirect(`/mitglieder/wawi?${q.toString()}`, 303);
  }

  const tag = berlinTag();
  const jahr = tag.slice(0, 4);

  try {
    const anzahl = (await pb.collection('chargen').getList(1, 1, { filter: `charge_nr~"${jahr}-"` })).totalItems;
    // Produkt-Charge: sofort freigegeben, THC/CBD wie gemessen/geschaetzt.
    // Konzentrate liegen praktisch immer ueber 10 % THC -> U21 automatisch zu.
    const produkt = await pb.collection('chargen').create({
      charge_nr: chargeNr(jahr, anzahl),
      sorte: quelle.sorte,
      sorte_name: quelle.sorte_name || '',
      status: 'freigegeben',
      produkt_typ: produktTyp(typ),
      herkunft: `Verarbeitung aus Charge ${quelle.charge_nr}`,
      trockengewicht_g: ertrag,
      verfuegbar_g: ertrag,
      thc_prozent: Number.isFinite(thc) && thc > 0 ? thc : null,
      cbd_prozent: Number.isFinite(cbd) && cbd >= 0 ? cbd : null,
      notiz,
    });
    await pb.collection('verarbeitungen').create({
      quelle_ref: quelle.id,
      quelle_nr: quelle.charge_nr || '',
      sorte_name: quelle.sorte_name || '',
      produkt_typ: produktTyp(typ),
      einsatz_g: einsatz,
      ertrag_g: ertrag,
      produkt_ref: produkt.id,
      produkt_nr: produkt.charge_nr,
      datum: tag,
      durchgefuehrt_von: mitglied.id,
      notiz,
    });
    // Quelle fortschreiben; bei 0 g Rest ist die Charge aufgebraucht.
    const rest = Math.max(0, Number(quelle.verfuegbar_g) - einsatz);
    const patch: Record<string, unknown> = { verfuegbar_g: rest };
    if (rest === 0) patch.status = 'aufgebraucht';
    await pb.collection('chargen').update(quelle.id, patch);
  } catch {
    return redirect('/mitglieder/wawi?fehler=fehlgeschlagen', 303);
  }

  return redirect('/mitglieder/wawi?ok=verarbeitet', 303);
};

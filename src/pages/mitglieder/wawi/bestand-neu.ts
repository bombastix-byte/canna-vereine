import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';
import { chargeNr } from '../../../lib/wawi';
import { produktTyp } from '../../../lib/verarbeitung';
import { berlinTag } from '../../../lib/ausgabe';

// Warenaufnahme: vorhandene Ware (Blüte/Haschisch/Rosin) als sofort
// freigegebene Charge anlegen - aus EINER Sorte ODER als Mix/freie Herkunft
// (dann nur eine freie Bezeichnung, keine Sorten-Zuordnung). Keine
// Pflanzen-Ebene. Für Bestand, der schon im Verkauf ist / Umstieg.
// Nur Anbauverantwortliche/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const sorteId = String(daten.get('sorte') ?? '').trim();
  const bezeichnung = String(daten.get('bezeichnung') ?? '').trim();
  const typ = produktTyp(String(daten.get('produkt_typ') ?? '').trim());
  const menge = Number(String(daten.get('trockengewicht_g') ?? '').replace(',', '.'));
  const thc = Number(String(daten.get('thc_prozent') ?? '').replace(',', '.'));
  const cbd = Number(String(daten.get('cbd_prozent') ?? '').replace(',', '.'));
  const ernte = String(daten.get('ernte_datum') ?? '').trim();
  const herkunft = String(daten.get('herkunft') ?? '').trim();

  // Anzeigename: freie Bezeichnung hat Vorrang; sonst der Sortenname. Eines
  // von beiden muss da sein (Mix = nur Bezeichnung, Einzelsorte = Dropdown).
  let sorteRef: string | null = null;
  let sorteName = bezeichnung;
  if (sorteId) {
    try {
      const sorte = await pb.collection('sorten').getOne(sorteId);
      sorteRef = sorte.id;
      if (!sorteName) sorteName = sorte.name;
    } catch {
      return redirect('/mitglieder/wawi?fehler=fehlgeschlagen', 303);
    }
  }
  if (!sorteName) return redirect('/mitglieder/wawi?fehler=fehlend', 303);
  if (!Number.isFinite(menge) || menge <= 0) return redirect('/mitglieder/wawi?fehler=menge', 303);

  try {
    const jahr = berlinTag().slice(0, 4);
    const anzahl = (await pb.collection('chargen').getList(1, 1, { filter: `charge_nr~"${jahr}-"` })).totalItems;
    await pb.collection('chargen').create({
      charge_nr: chargeNr(jahr, anzahl),
      sorte: sorteRef,
      sorte_name: sorteName,
      status: 'freigegeben',
      produkt_typ: typ,
      herkunft: herkunft || 'Warenaufnahme',
      ernte_datum: ernte ? `${ernte} 00:00:00.000Z` : null,
      trockengewicht_g: menge,
      verfuegbar_g: menge,
      thc_prozent: Number.isFinite(thc) && thc > 0 ? thc : null,
      cbd_prozent: Number.isFinite(cbd) && cbd >= 0 ? cbd : null,
      notiz: '',
    });
  } catch {
    return redirect('/mitglieder/wawi?fehler=fehlgeschlagen', 303);
  }

  return redirect('/mitglieder/wawi?ok=bestand', 303);
};

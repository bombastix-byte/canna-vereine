import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfBerichte } from '../../../lib/rollen';
import { csvAntwort } from '../../../lib/csv';
import { aggregiereJahr, jahrVon } from '../../../lib/jahresmeldung';
import { produktLabel } from '../../../lib/verarbeitung';
import { berlinTag } from '../../../lib/ausgabe';

// Behoerden-/Protokoll-Exporte als CSV (pseudonymisiert: Mitgliedsnummer
// statt Name/E-Mail). Arten: jahresmeldung | abgaben | vernichtungen | transporte.
// Zugriff: Vorstand und Praeventionsperson.
export const prerender = false;

export const GET: APIRoute = async ({ params, url, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfBerichte(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const art = params.art ?? '';
  const jahr = url.searchParams.get('jahr') ?? berlinTag().slice(0, 4);

  async function alle<T>(collection: string): Promise<T[]> {
    try {
      return (await pb.collection(collection).getFullList({ sort: 'created' })) as T[];
    } catch {
      return [];
    }
  }

  if (art === 'abgaben') {
    const rows = (await alle<Record<string, any>>('ausgaben')).filter((r) => (r.monat ?? '').slice(0, 4) === jahr);
    return csvAntwort(`abgaben-${jahr}.csv`, [
      ['Datum', 'Belegnr', 'Mitgliedsnummer', 'Produkt', 'Sorte', 'Charge', 'Menge (g)', 'THC (%)', 'CBD (%)', 'Beitrag (EUR)'],
      ...rows.map((r) => [r.tag, r.belegnr, r.mitgliedsnummer, produktLabel(r.produkt_typ), r.sorte_name, r.charge, r.menge_gramm, r.thc_prozent, r.cbd_prozent, r.beitrag_euro]),
    ]);
  }

  if (art === 'vernichtungen') {
    const rows = (await alle<Record<string, any>>('vernichtungen')).filter((r) => jahrVon(r.datum) === jahr);
    return csvAntwort(`vernichtungen-${jahr}.csv`, [
      ['Datum', 'Charge', 'Sorte', 'Menge (g)', 'Pflanzen (Stueck)', 'Pflanzen-Nrn', 'Grund', 'Zeuge', 'Notiz'],
      ...rows.map((r) => [r.datum, r.charge_nr, r.sorte_name, r.menge_gramm, r.anzahl_pflanzen, r.pflanzen_nrn, r.grund, r.zeuge, r.notiz]),
    ]);
  }

  if (art === 'transporte') {
    const rows = (await alle<Record<string, any>>('transporte')).filter((r) => jahrVon(r.datum) === jahr);
    return csvAntwort(`transporte-${jahr}.csv`, [
      ['Datum', 'Bescheinigungs-Nr', 'Charge', 'Sorte', 'Menge (g)', 'Von', 'Nach', 'Person', 'Zweck'],
      ...rows.map((r) => [r.datum, r.belegnr, r.charge_nr, r.sorte_name, r.menge_gramm, r.von, r.nach, r.person_name, r.zweck]),
    ]);
  }

  if (art === 'jahresmeldung') {
    const w = aggregiereJahr(jahr, {
      chargen: await alle('chargen'),
      ausgaben: await alle('ausgaben'),
      vernichtungen: await alle('vernichtungen'),
      verarbeitungen: await alle('verarbeitungen'),
      mitgliederzahl: (await alle('users')).length,
    });
    return csvAntwort(`jahresmeldung-${jahr}.csv`, [
      ['Kennzahl', 'Wert'],
      ['Berichtsjahr', w.jahr],
      ['Angebaute (getrocknete) Menge (g)', w.angebaut_g],
      ['Hergestelltes Haschisch/Rosin (g)', w.hergestellt_haschisch_g],
      ['An Mitglieder abgegebene Menge (g)', w.abgegeben_g],
      ['davon Marihuana/Bluete (g)', w.abgegeben_marihuana_g],
      ['davon Haschisch inkl. Rosin (g)', w.abgegeben_haschisch_g],
      ['Vernichtete Menge (g)', w.vernichtet_g],
      ['Mitgliederzahl (Stichtag Export)', w.mitgliederzahl],
      ['Zahl der Abgaben', w.anzahl_abgaben],
      ['Zahl der geernteten Chargen', w.anzahl_chargen],
    ]);
  }

  return redirect('/mitglieder/jahresmeldung', 303);
};

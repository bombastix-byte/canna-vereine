// Aggregiert die Jahreswerte fuer die behoerdliche Mitteilung (KCanG).
// Grundlage: die dokumentierten Chargen, Abgaben und Vernichtungen.
// Reine Funktionen, damit die Zahlen nachvollziehbar/testbar bleiben.

export interface ChargeAgg {
  ernte_datum?: string;
  trockengewicht_g?: number;
  status?: string;
}
export interface AusgabeAgg {
  menge_gramm?: number;
  monat?: string; // 'YYYY-MM'
  /** bluete | haschisch | rosin; leer/fehlend = Bluete (Altdaten). */
  produkt_typ?: string;
}
export interface VernichtungAgg {
  menge_gramm?: number;
  datum?: string; // 'YYYY-MM-DD'
}
export interface VerarbeitungAgg {
  ertrag_g?: number;
  datum?: string; // 'YYYY-MM-DD'
}

/** Jahr 'YYYY' aus einem ISO-/Datum-String, sonst null. */
export function jahrVon(s?: string): string | null {
  const m = /(\d{4})/.exec(s ?? '');
  return m ? m[1] : null;
}

export interface Jahreswerte {
  jahr: string;
  /** Produzierte (getrocknete) Menge aus in dem Jahr geernteten Chargen (g). */
  angebaut_g: number;
  /** An Mitglieder abgegebene Menge (g), gesamt. */
  abgegeben_g: number;
  /** Davon Marihuana/Bluete (g) - Paragraf 26 KCanG meldet getrennt. */
  abgegeben_marihuana_g: number;
  /** Davon Haschisch inkl. Rosin (g). */
  abgegeben_haschisch_g: number;
  /** Im Jahr durch Weiterverarbeitung hergestelltes Haschisch/Rosin (g). */
  hergestellt_haschisch_g: number;
  /** Dokumentiert vernichtete Menge (g). */
  vernichtet_g: number;
  /** Zahl der Abgaben (Buchungen). */
  anzahl_abgaben: number;
  /** Zahl der in dem Jahr geernteten Chargen. */
  anzahl_chargen: number;
  /** Mitgliederzahl zum Stichtag. */
  mitgliederzahl: number;
}

export function aggregiereJahr(
  jahr: string,
  daten: {
    chargen: ChargeAgg[];
    ausgaben: AusgabeAgg[];
    vernichtungen: VernichtungAgg[];
    mitgliederzahl: number;
    /** Weiterverarbeitungen (Haschisch/Rosin); optional fuer Altaufrufe. */
    verarbeitungen?: VerarbeitungAgg[];
  },
): Jahreswerte {
  const chargenJahr = daten.chargen.filter((c) => jahrVon(c.ernte_datum) === jahr);
  const ausgabenJahr = daten.ausgaben.filter((a) => (a.monat ?? '').slice(0, 4) === jahr);
  const vernJahr = daten.vernichtungen.filter((v) => jahrVon(v.datum) === jahr);
  const verarbJahr = (daten.verarbeitungen ?? []).filter((v) => jahrVon(v.datum) === jahr);
  const summe = (arr: Array<{ menge_gramm?: number }>, feld: 'menge_gramm') =>
    arr.reduce((s, r) => s + (Number(r[feld]) || 0), 0);

  // Paragraf 26 KCanG unterscheidet Marihuana und Haschisch; Rosin ist
  // (loesungsmittelfrei gewonnenes) Harz und zaehlt zu Haschisch. Fehlender
  // produkt_typ (Altdaten) zaehlt als Marihuana.
  const haschischJahr = ausgabenJahr.filter(
    (a) => a.produkt_typ === 'haschisch' || a.produkt_typ === 'rosin',
  );

  return {
    jahr,
    angebaut_g: chargenJahr.reduce((s, c) => s + (Number(c.trockengewicht_g) || 0), 0),
    abgegeben_g: summe(ausgabenJahr, 'menge_gramm'),
    abgegeben_haschisch_g: summe(haschischJahr, 'menge_gramm'),
    abgegeben_marihuana_g: summe(ausgabenJahr, 'menge_gramm') - summe(haschischJahr, 'menge_gramm'),
    hergestellt_haschisch_g: verarbJahr.reduce((s, v) => s + (Number(v.ertrag_g) || 0), 0),
    vernichtet_g: summe(vernJahr, 'menge_gramm'),
    anzahl_abgaben: ausgabenJahr.length,
    anzahl_chargen: chargenJahr.length,
    mitgliederzahl: daten.mitgliederzahl,
  };
}

/** Gramm hübsch (z. B. 1234.5 -> "1.234,5 g"). */
export function gramm(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' g';
}

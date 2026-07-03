// Weiterverarbeitung von Bluete zu Haschisch/Rosin. Rechtlicher Rahmen:
// KCanG zaehlt Haschisch (abgetrenntes Harz) zu Cannabis - loesungsmittelfrei
// gewonnenes Rosin faellt in dieselbe Kategorie. Die Jahresmeldung nach
// Paragraf 26 KCanG weist Marihuana und Haschisch GETRENNT aus, deshalb
// tragen Chargen und Abgaben einen produkt_typ. Extraktion mit
// Loesungsmitteln ist NICHT abgebildet (nicht zulaessig).
//
// Ein Produkt ist eine normale Charge (produkt_typ haschisch/rosin): damit
// gelten Limits, U21-THC-Sperre, Bestand und Rueckverfolgung automatisch.

export type ProduktTyp = 'bluete' | 'haschisch' | 'rosin';

export const PRODUKT_TYPEN: ProduktTyp[] = ['bluete', 'haschisch', 'rosin'];

/** Nur diese Typen koennen aus Bluete hergestellt werden. */
export const VERARBEITUNG_TYPEN: ProduktTyp[] = ['haschisch', 'rosin'];

export const PRODUKT_LABEL: Record<ProduktTyp, string> = {
  bluete: 'Blüte',
  haschisch: 'Haschisch',
  rosin: 'Rosin',
};

/** Leeres/unbekanntes Feld zaehlt als Bluete (Altdaten). */
export function produktTyp(wert?: string | null): ProduktTyp {
  return wert === 'haschisch' || wert === 'rosin' ? wert : 'bluete';
}

/** Anzeige-Label inkl. Altdaten-Fallback. */
export function produktLabel(wert?: string | null): string {
  return PRODUKT_LABEL[produktTyp(wert)];
}

/**
 * Kategorie fuer die Jahresmeldung (Paragraf 26 KCanG unterscheidet
 * Marihuana und Haschisch; Rosin ist Harz und zaehlt zu Haschisch).
 */
export function meldeKategorie(wert?: string | null): 'marihuana' | 'haschisch' {
  return produktTyp(wert) === 'bluete' ? 'marihuana' : 'haschisch';
}

export interface VerarbeitungEingabe {
  /** Herzustellendes Produkt. */
  typ: string;
  /** Eingesetzte Bluete in Gramm. */
  einsatzG: number;
  /** Gewonnenes Produkt in Gramm. */
  ertragG: number;
  /** Verfuegbarer Bestand der Quell-Charge in Gramm (null = unbekannt). */
  verfuegbarG: number | null;
  /** produkt_typ der Quell-Charge (nur Bluete darf verarbeitet werden). */
  quelleTyp?: string | null;
  /** Status der Quell-Charge (muss freigegeben sein). */
  quelleStatus?: string;
}

export interface VerarbeitungErgebnis {
  ok: boolean;
  meldung?: string;
}

/** Plausibilitaet einer Verarbeitung; Reihenfolge: Typ, Quelle, Mengen. */
export function pruefeVerarbeitung(e: VerarbeitungEingabe): VerarbeitungErgebnis {
  if (!VERARBEITUNG_TYPEN.includes(e.typ as ProduktTyp)) {
    return { ok: false, meldung: 'Unbekanntes Produkt - moeglich sind Haschisch und Rosin.' };
  }
  if (produktTyp(e.quelleTyp) !== 'bluete') {
    return { ok: false, meldung: 'Nur Blueten-Chargen koennen weiterverarbeitet werden.' };
  }
  if (e.quelleStatus !== 'freigegeben') {
    return { ok: false, meldung: 'Die Quell-Charge ist nicht freigegeben.' };
  }
  if (!Number.isFinite(e.einsatzG) || e.einsatzG <= 0) {
    return { ok: false, meldung: 'Bitte den Einsatz in Gramm angeben.' };
  }
  if (!Number.isFinite(e.ertragG) || e.ertragG <= 0) {
    return { ok: false, meldung: 'Bitte den Ertrag in Gramm angeben.' };
  }
  if (e.ertragG > e.einsatzG) {
    return { ok: false, meldung: 'Der Ertrag kann nicht groesser als der Einsatz sein.' };
  }
  if (e.verfuegbarG == null || e.einsatzG > e.verfuegbarG) {
    return {
      ok: false,
      meldung: `Nicht genug Bestand in der Quell-Charge (verfuegbar: ${e.verfuegbarG ?? 'unbekannt'} g).`,
    };
  }
  return { ok: true };
}

/** Ausbeute in Prozent (z. B. 50 g -> 8 g = 16), gerundet auf eine Stelle. */
export function ausbeuteProzent(einsatzG: number, ertragG: number): number | null {
  if (!einsatzG || einsatzG <= 0 || !Number.isFinite(ertragG)) return null;
  return Math.round((ertragG / einsatzG) * 1000) / 10;
}

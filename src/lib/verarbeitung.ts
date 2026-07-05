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
export type MeldeKategorie = 'marihuana' | 'haschisch';

export interface ProduktDef {
  key: ProduktTyp;
  label: string;
  /** Kategorie fuer die Jahresmeldung (Paragraf 26 KCanG). */
  kategorie: MeldeKategorie;
  /** Aus Bluete im Verein herstellbar (Verarbeitung)? */
  herstellbar: boolean;
}

/**
 * Zentrale Produktliste. ERWEITERN: neuen Eintrag ergaenzen (und den Typ oben)
 * - z. B. { key: 'kief', label: 'Kief/Pollen', kategorie: 'haschisch',
 * herstellbar: true }. Die Kategorie steuert automatisch die Jahresmeldung;
 * mehr braucht es nicht. Rechtlicher Rahmen: KCanG kennt nur Marihuana (Bluete)
 * und Haschisch (abgetrenntes Harz - dazu zaehlt loesungsmittelfreies Rosin).
 */
export const PRODUKTE: ProduktDef[] = [
  { key: 'bluete', label: 'Blüte', kategorie: 'marihuana', herstellbar: false },
  { key: 'haschisch', label: 'Haschisch', kategorie: 'haschisch', herstellbar: true },
  { key: 'rosin', label: 'Rosin', kategorie: 'haschisch', herstellbar: true },
];

const PRODUKT_MAP: Record<string, ProduktDef> = Object.fromEntries(PRODUKTE.map((p) => [p.key, p]));

export const PRODUKT_TYPEN: ProduktTyp[] = PRODUKTE.map((p) => p.key);

/** Produkte, die aus Bluete hergestellt werden koennen (Verarbeitung). */
export const VERARBEITUNG_TYPEN: ProduktTyp[] = PRODUKTE.filter((p) => p.herstellbar).map((p) => p.key);

export const PRODUKT_LABEL: Record<ProduktTyp, string> = Object.fromEntries(
  PRODUKTE.map((p) => [p.key, p.label]),
) as Record<ProduktTyp, string>;

/** Bekannter Produkt-Key oder Bluete als Fallback (Altdaten/leer). */
export function produktTyp(wert?: string | null): ProduktTyp {
  return wert && PRODUKT_MAP[wert] ? (wert as ProduktTyp) : 'bluete';
}

/** Anzeige-Label inkl. Altdaten-Fallback. */
export function produktLabel(wert?: string | null): string {
  return PRODUKT_MAP[produktTyp(wert)].label;
}

/**
 * Kategorie fuer die Jahresmeldung (Paragraf 26 KCanG unterscheidet
 * Marihuana und Haschisch; Rosin ist Harz und zaehlt zu Haschisch).
 */
export function meldeKategorie(wert?: string | null): MeldeKategorie {
  return PRODUKT_MAP[produktTyp(wert)].kategorie;
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

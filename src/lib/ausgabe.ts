// Kernlogik der KCanG-konformen Abgabe (Ausgabe an Mitglieder).
// Bewusst als reine Funktionen ohne PocketBase-/Astro-Abhaengigkeit, damit die
// gesetzlichen Grenzwerte isoliert nachvollziehbar und testbar bleiben.
//
// Gesetzliche Grundlage (KCanG, Stand Bau; vor Live mit Rechtsberatung
// gegenpruefen): Weitergabe an Mitglieder hoechstens 25 g/Tag und 50 g/Monat;
// fuer Heranwachsende (18 bis unter 21 Jahre) hoechstens 30 g/Monat und nur
// Cannabis mit hoechstens 10 % THC.

/** Tageshoechstmenge in Gramm. */
export const LIMIT_TAG_G = 25;
/** Monatshoechstmenge in Gramm (ab 21 Jahren). */
export const LIMIT_MONAT_G = 50;
/** Monatshoechstmenge in Gramm fuer 18- bis unter 21-Jaehrige. */
export const LIMIT_MONAT_U21_G = 30;
/** Hoechster THC-Gehalt (Prozent) fuer die Abgabe an unter 21-Jaehrige. */
export const U21_MAX_THC = 10;
/** Alter (Jahre), unterhalb dessen die strengeren U21-Regeln gelten. */
export const U21_GRENZE = 21;
/** Selbstkostenbeitrag je Gramm in Euro (vom Verein festgelegt). */
export const BEITRAG_PRO_GRAMM = 8.5;

/** Berlin-lokales Kalenderdatum 'YYYY-MM-DD', unabhaengig von der Serverzeit. */
export function berlinTag(d: Date = new Date()): string {
  // en-CA liefert das ISO-Format YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d);
}

/** Kalendermonat 'YYYY-MM' zu einem Tag 'YYYY-MM-DD'. */
export function berlinMonat(tag: string): string {
  return tag.slice(0, 7);
}

/**
 * Alter in vollen Jahren an einem Stichtag (beide als 'YYYY-MM-DD').
 * Liefert null, wenn das Geburtsdatum fehlt oder nicht parsebar ist.
 */
export function alterAmTag(geburtsdatum: string | undefined, tag: string): number | null {
  const g = /^(\d{4})-(\d{2})-(\d{2})/.exec(geburtsdatum ?? '');
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(tag);
  if (!g || !t) return null;
  const [, gj, gm, gt] = g.map(Number) as unknown as number[];
  const [, tj, tm, tt] = t.map(Number) as unknown as number[];
  let alter = tj - gj;
  if (tm < gm || (tm === gm && tt < gt)) alter--;
  return alter;
}

/**
 * Gilt fuer dieses Mitglied die U21-Sonderregel?
 * WICHTIG: Ist das Geburtsdatum unbekannt, wird sicherheitshalber U21
 * angenommen (strengere Grenzen), damit nie versehentlich zu viel/zu hoch
 * abgegeben wird. Der Aufrufer sollte fehlendes Geburtsdatum zusaetzlich
 * als Warnung behandeln.
 */
export function istU21(geburtsdatum: string | undefined, tag: string): boolean {
  const alter = alterAmTag(geburtsdatum, tag);
  if (alter === null) return true; // unbekannt -> strengste Regel
  return alter < U21_GRENZE;
}

export interface LimitEingabe {
  /** Gilt die U21-Sonderregel (30 g/Monat, hoechstens 10 % THC)? */
  u21: boolean;
  /** War das Geburtsdatum bekannt? Bei false ist u21 nur eine Annahme. */
  alterBekannt: boolean;
  /** THC-Gehalt der Sorte in Prozent, oder null wenn unbekannt. */
  thcProzent: number | null;
  /** Bereits heute an dieses Mitglied abgegebene Menge (Gramm). */
  mengeHeuteBisher: number;
  /** Bereits in diesem Kalendermonat abgegebene Menge (Gramm). */
  mengeMonatBisher: number;
  /** Jetzt gewuenschte Menge (Gramm). */
  mengeNeu: number;
  /** Aktueller Bestand der Sorte (Gramm), oder null wenn nicht gefuehrt. */
  bestandGramm?: number | null;
}

export type LimitCode =
  | 'menge'
  | 'u21_thc'
  | 'u21_alter_unbekannt'
  | 'tageslimit'
  | 'monatslimit'
  | 'bestand';

export interface LimitErgebnis {
  ok: boolean;
  code?: LimitCode;
  meldung?: string;
  /** Verbleibende Tagesmenge VOR dieser Abgabe (Gramm). */
  restTag: number;
  /** Verbleibende Monatsmenge VOR dieser Abgabe (Gramm). */
  restMonat: number;
  /** Das an diesem Tag geltende Monatslimit (30 oder 50 g). */
  monatslimit: number;
}

/**
 * Prueft eine geplante Abgabe gegen alle gesetzlichen Grenzen.
 * Reihenfolge der Pruefung ist bewusst: erst gueltige Menge, dann harte
 * U21-THC-Sperre, dann Tages-, dann Monatslimit, zuletzt Bestand.
 */
export function pruefeLimit(e: LimitEingabe): LimitErgebnis {
  const monatslimit = e.u21 ? LIMIT_MONAT_U21_G : LIMIT_MONAT_G;
  const restTag = Math.max(0, LIMIT_TAG_G - e.mengeHeuteBisher);
  const restMonat = Math.max(0, monatslimit - e.mengeMonatBisher);
  const basis = { restTag, restMonat, monatslimit };

  if (!Number.isFinite(e.mengeNeu) || e.mengeNeu <= 0) {
    return { ok: false, code: 'menge', meldung: 'Bitte eine gueltige Menge in Gramm angeben.', ...basis };
  }

  if (e.u21) {
    if (e.thcProzent === null) {
      return {
        ok: false,
        code: 'u21_thc',
        meldung: 'THC-Gehalt der Sorte unbekannt - Abgabe an unter 21-Jaehrige nicht moeglich.',
        ...basis,
      };
    }
    if (e.thcProzent > U21_MAX_THC) {
      return {
        ok: false,
        code: 'u21_thc',
        meldung: `Mitglied unter 21: nur Sorten mit hoechstens ${U21_MAX_THC} % THC zulaessig (Sorte hat ${e.thcProzent} %).`,
        ...basis,
      };
    }
  }

  if (e.mengeHeuteBisher + e.mengeNeu > LIMIT_TAG_G) {
    return {
      ok: false,
      code: 'tageslimit',
      meldung: `Tageslimit ${LIMIT_TAG_G} g ueberschritten - heute noch ${restTag} g moeglich.`,
      ...basis,
    };
  }

  if (e.mengeMonatBisher + e.mengeNeu > monatslimit) {
    return {
      ok: false,
      code: 'monatslimit',
      meldung: `Monatslimit ${monatslimit} g ueberschritten - diesen Monat noch ${restMonat} g moeglich.`,
      ...basis,
    };
  }

  if (e.bestandGramm != null && e.mengeNeu > e.bestandGramm) {
    return {
      ok: false,
      code: 'bestand',
      meldung: `Nicht genug Bestand - verfuegbar sind ${e.bestandGramm} g.`,
      ...basis,
    };
  }

  return { ok: true, ...basis };
}

/** Selbstkostenbeitrag fuer eine Menge, auf Cent gerundet. */
export function beitragEuro(mengeGramm: number): number {
  return Math.round(mengeGramm * BEITRAG_PRO_GRAMM * 100) / 100;
}

/** Summiert die Mengen (Gramm) einer Liste von Abgabe-Datensaetzen. */
export function summeGramm(rows: Array<{ menge_gramm?: number }>): number {
  return rows.reduce((s, r) => s + (Number(r.menge_gramm) || 0), 0);
}

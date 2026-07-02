// Weitergabe von Vermehrungsmaterial (Samen/Stecklinge) an Mitglieder.
// KCanG: hoechstens 7 Samen ODER 5 Stecklinge je Mitglied und Monat.
// (Vor Live mit Rechtsberatung gegenpruefen.) Reine, testbare Logik.

export type Vermehrungsart = 'samen' | 'stecklinge';

export const ARTEN: Vermehrungsart[] = ['samen', 'stecklinge'];
export const ART_LABEL: Record<Vermehrungsart, string> = {
  samen: 'Samen',
  stecklinge: 'Stecklinge',
};

export const LIMIT_SAMEN_MONAT = 7;
export const LIMIT_STECKLINGE_MONAT = 5;

export function limitFuer(art: string): number {
  return art === 'stecklinge' ? LIMIT_STECKLINGE_MONAT : LIMIT_SAMEN_MONAT;
}

export interface VermehrungEingabe {
  art: string;
  /** Bereits in diesem Monat an dieses Mitglied ausgegebene Stueckzahl der Art. */
  bisherMonat: number;
  anzahlNeu: number;
}
export interface VermehrungErgebnis {
  ok: boolean;
  code?: 'art' | 'anzahl' | 'limit';
  meldung?: string;
  limit: number;
  rest: number;
}

export function pruefeVermehrung(e: VermehrungEingabe): VermehrungErgebnis {
  const limit = limitFuer(e.art);
  const rest = Math.max(0, limit - e.bisherMonat);
  if (!ARTEN.includes(e.art as Vermehrungsart)) {
    return { ok: false, code: 'art', meldung: 'Unbekannte Art.', limit, rest };
  }
  if (!Number.isInteger(e.anzahlNeu) || e.anzahlNeu <= 0) {
    return { ok: false, code: 'anzahl', meldung: 'Bitte eine gueltige Stueckzahl angeben.', limit, rest };
  }
  if (e.bisherMonat + e.anzahlNeu > limit) {
    return {
      ok: false,
      code: 'limit',
      meldung: `Monatsgrenze ${limit} ${ART_LABEL[e.art as Vermehrungsart]} ueberschritten - diesen Monat noch ${rest} moeglich.`,
      limit,
      rest,
    };
  }
  return { ok: true, limit, rest };
}

/** Summiert Stueckzahlen einer Liste (fuer eine Art vorgefiltert). */
export function summeStueck(rows: Array<{ anzahl?: number }>): number {
  return rows.reduce((s, r) => s + (Number(r.anzahl) || 0), 0);
}

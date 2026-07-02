// Logik der Warenwirtschaft: Charge-Lebenszyklus vom Anbau bis zur Freigabe,
// Schwund (frisch -> trocken), Chargennummer, Vernichtungsgruende.
// Eine Charge ist die rueckverfolgbare Einheit: ein Anbaulos einer Sorte.

export type ChargeStatus = 'anbau' | 'geerntet' | 'freigegeben' | 'gesperrt' | 'aufgebraucht';

export const CHARGE_STATUS: ChargeStatus[] = [
  'anbau',
  'geerntet',
  'freigegeben',
  'gesperrt',
  'aufgebraucht',
];

export const STATUS_LABEL: Record<ChargeStatus, string> = {
  anbau: 'Im Anbau',
  geerntet: 'Geerntet (Trocknung)',
  freigegeben: 'Freigegeben',
  gesperrt: 'Gesperrt',
  aufgebraucht: 'Aufgebraucht',
};

/** Erlaubte naechste Aktionen je Status. */
export function moeglicheAktionen(status?: string): Array<'ernte' | 'freigabe' | 'sperren' | 'vernichten'> {
  switch (status) {
    case 'anbau':
      return ['ernte', 'sperren', 'vernichten'];
    case 'geerntet':
      return ['freigabe', 'sperren', 'vernichten'];
    case 'freigegeben':
      return ['sperren', 'vernichten'];
    default:
      return [];
  }
}

/** Schwund in Prozent (Frisch- zu Trockengewicht), fuer die Anzeige. */
export function schwundProzent(frisch?: number, trocken?: number): number | null {
  if (!frisch || frisch <= 0 || trocken == null) return null;
  return Math.round((1 - trocken / frisch) * 1000) / 10;
}

/** Naechste Chargennummer 'JAHR-0001' aus Jahr + bisheriger Anzahl im Jahr. */
export function chargeNr(jahr: string, anzahlBisher: number): string {
  return `${jahr}-${String(anzahlBisher + 1).padStart(4, '0')}`;
}

export const VERNICHTUNG_GRUENDE = [
  'Schädlings-/Krankheitsbefall',
  'Qualitätsmangel',
  'Überschuss über Bedarf',
  'Verderb/Schimmel',
  'Trocknungsschwund',
  'Sonstiges',
];

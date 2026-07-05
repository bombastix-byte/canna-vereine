// Mitglieds-Lebenszyklus: statt Hart-Löschen ein Status mit optionalem
// Austrittsdatum. „gekündigt" bleibt bis zum Austrittsdatum abgabeberechtigt,
// danach gilt das Mitglied als ausgetreten.

export const MITGLIED_STATUS = ['aktiv', 'ruhend', 'gekuendigt', 'ausgetreten'] as const;
export type MitgliedStatus = (typeof MITGLIED_STATUS)[number];

export const STATUS_LABEL: Record<string, string> = {
  aktiv: 'Aktiv',
  ruhend: 'Ruhend',
  gekuendigt: 'Gekündigt',
  ausgetreten: 'Ausgetreten',
};

export interface StatusMitglied {
  mitglied_status?: string;
  austritt_zum?: string;
}

/** YYYY-MM-DD aus einem ISO-/Datumsstring. */
function tag(s?: string): string {
  return s ? s.slice(0, 10) : '';
}

/**
 * Effektiver Status zum Stichtag: „gekündigt" mit erreichtem Austrittsdatum
 * gilt als „ausgetreten". Sonst der gespeicherte Status (Default aktiv).
 */
export function effektiverStatus(u: StatusMitglied, heute: string): MitgliedStatus {
  const s = (u.mitglied_status as MitgliedStatus) || 'aktiv';
  if (s === 'gekuendigt' && u.austritt_zum && tag(u.austritt_zum) <= heute) return 'ausgetreten';
  return s;
}

/** Darf dem Mitglied am Stichtag Cannabis abgegeben werden? */
export function abgabeErlaubt(u: StatusMitglied, heute: string): boolean {
  const s = effektiverStatus(u, heute);
  return s === 'aktiv' || s === 'gekuendigt';
}

/** Kurzer Klartext für den Grund einer Sperre (leer, wenn Abgabe erlaubt). */
export function abgabeSperrGrund(u: StatusMitglied, heute: string): string {
  const s = effektiverStatus(u, heute);
  if (s === 'ruhend') return 'Mitgliedschaft ruht';
  if (s === 'ausgetreten') return 'Mitglied ausgetreten';
  return '';
}

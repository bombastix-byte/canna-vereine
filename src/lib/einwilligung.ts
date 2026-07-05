// Einwilligungs-/Kenntnisnahme-Nachweis (§ 23 KCanG): Mitglieder bestätigen beim
// ersten Login (und nach einer Änderung der Hinweise) die Kenntnisnahme der
// Präventions- und Gesundheitshinweise. Erhöht sich die Version, muss erneut
// bestätigt werden.

/** Aktuelle Version der Hinweise. Bei inhaltlicher Änderung hochzählen -
 *  dann bestätigen alle Mitglieder erneut. */
export const HINWEIS_VERSION = '2026-07';

export interface EinwilligungMitglied {
  hinweise_version?: string;
  hinweise_bestaetigt_am?: string;
}

/** Muss das Mitglied die (aktuellen) Hinweise noch bestätigen? */
export function mussBestaetigen(u: EinwilligungMitglied): boolean {
  return (u.hinweise_version ?? '') !== HINWEIS_VERSION;
}

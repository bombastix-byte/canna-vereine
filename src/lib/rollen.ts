// Rollen- und Rechtemodell der Anbauvereinigung ("wer darf was").
// Rollen liegen als Mehrfach-Auswahl (`rollen`) auf jedem Mitglied (users).
// Vorstand hat implizit alle operativen Rechte.
//
// Rechtlicher Rahmen: Vorstand (Paragraf 26 BGB) und Praeventionsbeauftragte
// Person (Paragraf 23 KCanG) sind vorgeschrieben; Anbau- und Ausgabekraefte
// sind die interne Organisation der Vereinigung.

export type Rolle = 'mitglied' | 'ausgabe' | 'anbau' | 'praevention' | 'vorstand';

export const ROLLEN: Rolle[] = ['mitglied', 'ausgabe', 'anbau', 'praevention', 'vorstand'];

export const ROLLEN_LABEL: Record<Rolle, string> = {
  mitglied: 'Mitglied',
  ausgabe: 'Ausgabekraft (Tresen)',
  anbau: 'Anbau- und Ernteverantwortliche',
  praevention: 'Präventionsbeauftragte Person',
  vorstand: 'Vorstand',
};

export const ROLLEN_BESCHREIBUNG: Record<Rolle, string> = {
  mitglied: 'Sieht den Mitgliederbereich und die eigenen Abgaben/Vorbestellungen.',
  ausgabe: 'Bucht die Abgabe am Tresen; prüft dabei automatisch die gesetzlichen Grenzen.',
  anbau: 'Führt die Warenwirtschaft: Chargen anlegen, Anbau, Ernte, Trocknung, Freigabe und Vernichtung dokumentieren.',
  praevention: 'Präventionsbeauftragte Person nach § 23 KCanG. Einsicht in die Dokumentation, Ansprechperson für Jugend-/Gesundheitsschutz.',
  vorstand: 'Vertretungsberechtigter Vorstand nach § 26 BGB. Vollzugriff: alle Rechte, Mitglieder- und Rollenverwaltung, Berichte und Jahresmeldung.',
};

/** Normalisiert das rollen-Feld (Array oder String) zu einem string[]. */
export function alsRollen(wert: unknown): string[] {
  if (Array.isArray(wert)) return wert.map(String);
  if (typeof wert === 'string' && wert) return [wert];
  return [];
}

export function hatRolle(rollen: string[] | undefined, r: Rolle): boolean {
  return !!rollen && rollen.includes(r);
}

/** Vollzugriff. */
export function istVorstand(rollen?: string[]): boolean {
  return hatRolle(rollen, 'vorstand');
}

/** Darf am Tresen abgeben. */
export function darfAusgeben(rollen?: string[]): boolean {
  return hatRolle(rollen, 'ausgabe') || istVorstand(rollen);
}

/** Darf die Warenwirtschaft/Chargen führen (Anbau, Ernte, Vernichtung). */
export function darfAnbau(rollen?: string[]): boolean {
  return hatRolle(rollen, 'anbau') || istVorstand(rollen);
}

/** Darf Berichte/Jahresmeldung einsehen (Vorstand oder Präventionsperson). */
export function darfBerichte(rollen?: string[]): boolean {
  return hatRolle(rollen, 'praevention') || istVorstand(rollen);
}

/** Darf Mitglieder und Rollen verwalten (nur Vorstand). */
export function darfVerwalten(rollen?: string[]): boolean {
  return istVorstand(rollen);
}

/**
 * Darf jemand mit diesen Rollen einen Dienst mit Rollen-Anforderung
 * uebernehmen? Ohne Anforderung darf jedes Mitglied; Vorstand darf immer.
 * (Beispiel: "Bestand wiegen" nur fuer das Anbau-Team.)
 */
export function darfDienst(rollen: string[] | undefined, benoetigt?: string): boolean {
  if (!benoetigt) return true;
  return hatRolle(rollen, benoetigt as Rolle) || istVorstand(rollen);
}

/** Kurze Anzeige-Labels fuer Dienst-Anforderungen (Badges). */
export const TEAM_LABEL: Record<string, string> = {
  anbau: 'Anbau-Team',
  ausgabe: 'Ausgabe-Team',
  vorstand: 'Vorstand',
};

/** Irgendeine Personal-Rolle (nicht nur einfaches Mitglied). */
export function istPersonal(rollen?: string[]): boolean {
  return (
    darfAusgeben(rollen) ||
    darfAnbau(rollen) ||
    hatRolle(rollen, 'praevention') ||
    istVorstand(rollen)
  );
}

// PocketBase-Regelbausteine (Multi-Select nutzt ~ = "enthaelt").
export const REGEL = {
  angemeldet: '@request.auth.id != ""',
  ausgabe: '(@request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "vorstand")',
  anbau: '(@request.auth.rollen ~ "anbau" || @request.auth.rollen ~ "vorstand")',
  vorstand: '@request.auth.rollen ~ "vorstand"',
  berichte: '(@request.auth.rollen ~ "vorstand" || @request.auth.rollen ~ "praevention")',
  // Anbau bucht/pflegt, Ausgabe muss Chargen lesen und den Bestand fortschreiben.
  wareLesen:
    '@request.auth.rollen ~ "anbau" || @request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "vorstand"',
  wareSchreiben:
    '@request.auth.rollen ~ "anbau" || @request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "vorstand"',
};

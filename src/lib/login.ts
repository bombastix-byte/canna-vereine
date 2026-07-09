// Datensparsamer Login: Vereine mit login_modus 'mitgliedsnummer' melden sich
// nur über die Mitgliedsnummer an. PocketBase braucht technisch eine
// E-Mail-Identität — dafür wird eine SYNTHETISCHE, nicht personenbezogene
// Kennung `<nummer>@<vereinsid>.local` verwendet (keine echte Adresse). So
// laufen keine personenbezogenen Daten über den Server.
import { site } from '../config';

/** Synthetische, nicht personenbezogene Login-Kennung aus der Mitgliedsnummer. */
export function syntheticEmail(mitgliedsnummer: string, siteId: string = site.id): string {
  const nr = String(mitgliedsnummer).trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `${nr}@${siteId}.local`;
}

/**
 * Wandelt die Anmelde-Eingabe in die PocketBase-Identität um. Enthält die
 * Eingabe ein „@", gilt sie als echte E-Mail (E-Mail-Modus oder freiwillige
 * Reset-Mail); sonst als Mitgliedsnummer → synthetische Kennung.
 */
export function loginIdentitaet(eingabe: string): string {
  const e = eingabe.trim();
  return e.includes('@') ? e : syntheticEmail(e);
}

// Laufzeit-Auswertung der Funktions-Module: Config-Defaults (Build) werden von
// den in der DB gespeicherten Einstellungen überschrieben. So kann der Vorstand
// Module live im Admin umschalten. Wird pro Anfrage in der Middleware geladen
// und in `Astro.locals.funktionen` bereitgestellt.
import type PocketBase from 'pocketbase';
import { site } from '../config';
import type { FunktionsSchluessel } from '../config/types';
import type { KonnektorConfig } from './kassen-konnektor';

export const MODUL_KEYS: FunktionsSchluessel[] = [
  'beitraege', 'verarbeitung', 'kasse', 'vorbestellung', 'termine', 'helferplan', 'abstimmungen', 'antraege', 'push',
  'bewertungen', 'brett', 'aushang', 'wissen', 'ausweis', 'app', 'sicherheit',
];

export type Funktionen = Record<FunktionsSchluessel, boolean> & { aufnahmebeitragEuro: number };

/** Reine Config-Defaults (ohne DB). Ein Modul ist AN, solange nicht auf false. */
export function funktionenDefault(): Funktionen {
  const f = {} as Funktionen;
  for (const k of MODUL_KEYS) f[k] = site.funktionen?.[k] !== false;
  f.aufnahmebeitragEuro = Math.max(0, Number(site.aufnahmebeitrag_euro) || 0);
  return f;
}

/**
 * Effektive Funktionen: Config-Default, überschrieben durch die DB-Einstellung
 * (nur ausdrücklich gesetzte Schlüssel überschreiben). Wirft nie — bei Fehlern
 * gelten die Config-Defaults.
 */
export async function ladeFunktionen(pb: PocketBase): Promise<Funktionen> {
  const eff = funktionenDefault();
  try {
    const row = await pb.collection('einstellungen').getFirstListItem('');
    const gesetzt = (row.funktionen ?? {}) as Record<string, unknown>;
    for (const k of MODUL_KEYS) {
      if (gesetzt[k] === true || gesetzt[k] === false) eff[k] = gesetzt[k] as boolean;
    }
    if (row.aufnahmebeitrag_euro != null && row.aufnahmebeitrag_euro !== '') {
      eff.aufnahmebeitragEuro = Math.max(0, Number(row.aufnahmebeitrag_euro) || 0);
    }
  } catch {
    /* keine/leere Einstellung -> Defaults */
  }
  return eff;
}

/** Kassen-Konnektor-Konfiguration aus der DB (Default: keiner). Wirft nie. */
export async function ladeKonnektor(pb: PocketBase): Promise<KonnektorConfig> {
  try {
    const row = await pb.collection('einstellungen').getFirstListItem('');
    const k = (row.kasse_extern ?? {}) as Partial<KonnektorConfig>;
    const typ = k.typ === 'webhook' || k.typ === 'jtl' ? k.typ : 'keiner';
    return { typ, url: typeof k.url === 'string' ? k.url : '', token: typeof k.token === 'string' ? k.token : '' };
  } catch {
    return { typ: 'keiner' };
  }
}

/** Menschlesbare Labels der Module (für die Admin-Oberfläche). */
export const MODUL_LABEL: Record<FunktionsSchluessel, string> = {
  beitraege: 'Mitgliedsbeiträge (SEPA, Mahnwesen)',
  verarbeitung: 'Weiterverarbeitung (Haschisch/Rosin)',
  kasse: 'Kasse (Kassenbuch & Tagesabschluss)',
  vorbestellung: 'Vorbestellung',
  termine: 'Termine (Zu-/Absage)',
  helferplan: 'Helferplan',
  abstimmungen: 'Abstimmungen',
  antraege: 'Online-Beitrittsanträge',
  push: 'Push-Benachrichtigungen',
  bewertungen: 'Sortenbewertung durch Mitglieder',
  brett: 'Schwarzes Brett',
  aushang: 'Aushang (Ankündigungen)',
  wissen: 'Wissen (Anleitungen, Sortenberichte, Prävention)',
  ausweis: 'Digitaler Mitgliedsausweis',
  app: 'Vereins-App (Download)',
  sicherheit: 'Sicherheit (2FA, Push)',
};

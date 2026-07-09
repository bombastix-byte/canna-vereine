import PocketBase from 'pocketbase';

// Konfiguration zur Laufzeit ueber Umgebungsvariablen (process.env hat Vorrang,
// damit der gebaute Server pro Container konfigurierbar bleibt).
function env(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return import.meta.env[key] as string | undefined;
}

// Server-seitige Adresse von PocketBase (Auth, Daten lesen). Lokal Standard;
// in Produktion z. B. die interne Adresse des PB-Containers.
export const PB_URL = env('PB_URL') ?? 'http://127.0.0.1:8090';

// Oeffentliche Adresse von PocketBase fuer browser-seitige Links (Datei-
// Downloads). Hinter einem Reverse-Proxy die echte Domain; sonst gleich PB_URL.
export const PB_PUBLIC_URL = env('PB_PUBLIC_URL') ?? PB_URL;

// Name des httpOnly-Cookies, in dem der Auth-Token der Mitglieder liegt.
export const AUTH_COOKIE = 'pb_token';

// Zwischen-Cookie waehrend der Zwei-Faktor-Anmeldung: Passwort war richtig,
// der TOTP-Code steht noch aus. Kurzlebig; wird nach dem Code-Schritt geloescht.
export const PENDING_COOKIE = 'pb_pending';

/** Neuer, nicht authentifizierter PocketBase-Client (pro Anfrage einmalig). */
export function neuePb(): PocketBase {
  return new PocketBase(PB_URL);
}

/** Browser-taugliche Download-URL einer Datei (nutzt die oeffentliche Adresse). */
export function dateiUrl(
  record: { collectionId: string; id: string },
  datei: string,
): string {
  return `${PB_PUBLIC_URL}/api/files/${record.collectionId}/${record.id}/${datei}`;
}

import { alsRollen } from './rollen';

export interface Mitglied {
  id: string;
  email: string;
  name?: string;
  /** Frei gewählter Anzeigename (Alias) statt „Mitglied M-…". */
  alias?: string;
  /** Zugewiesene Rollen (Mehrfach). Steuert alle Rechte. Siehe lib/rollen.ts. */
  rollen: string[];
  /** Vereinsinterne Mitgliedsnummer (fuer Beleg/Identifikation). */
  mitgliedsnummer?: string;
  /** ISO-Geburtsdatum (fuer die U21-Regel bei der Ausgabe). */
  geburtsdatum?: string;
  /** Bestaetigte Version der Praeventions-/Gesundheitshinweise (§ 23). */
  hinweise_version?: string;
  /** Zeitpunkt der Bestaetigung. */
  hinweise_bestaetigt_am?: string;
}

/**
 * Validiert einen Token gegen PocketBase und liefert das Mitglied zurueck,
 * oder null wenn ungueltig/abgelaufen oder der Server nicht erreichbar ist.
 * Der zurueckgegebene Client ist danach authentifiziert und kann Daten lesen.
 */
export async function mitgliedAusToken(
  token: string | undefined,
): Promise<{ pb: PocketBase; mitglied: Mitglied } | null> {
  if (!token) return null;
  const pb = neuePb();
  pb.authStore.save(token, null);
  try {
    const { record } = await pb.collection('users').authRefresh();
    return {
      pb,
      mitglied: {
        id: record.id,
        email: record.email as string,
        name: (record.name as string) || undefined,
        alias: (record.alias as string) || undefined,
        rollen: alsRollen(record.rollen).length ? alsRollen(record.rollen) : ['mitglied'],
        mitgliedsnummer: (record.mitgliedsnummer as string) || undefined,
        geburtsdatum: (record.geburtsdatum as string) || undefined,
        hinweise_version: (record.hinweise_version as string) || undefined,
        hinweise_bestaetigt_am: (record.hinweise_bestaetigt_am as string) || undefined,
      },
    };
  } catch {
    return null;
  }
}

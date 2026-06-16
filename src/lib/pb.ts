import PocketBase from 'pocketbase';

// Adresse des selbst gehosteten PocketBase. Lokal Standard, in Produktion
// per Umgebungsvariable PB_URL setzen (z. B. interne Adresse des Servers).
export const PB_URL =
  (import.meta.env.PB_URL as string | undefined) ?? 'http://127.0.0.1:8090';

// Name des httpOnly-Cookies, in dem der Auth-Token der Mitglieder liegt.
export const AUTH_COOKIE = 'pb_token';

/** Neuer, nicht authentifizierter PocketBase-Client (pro Anfrage einmalig). */
export function neuePb(): PocketBase {
  return new PocketBase(PB_URL);
}

export interface Mitglied {
  id: string;
  email: string;
  name?: string;
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
      },
    };
  } catch {
    return null;
  }
}

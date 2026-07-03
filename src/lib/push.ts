// Web-Push-Benachrichtigungen (VAPID). Konfiguration ueber Env:
//   VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (mailto:...)
// Ohne Schluessel ist Push inaktiv (Rueckgaben leer) - alles laeuft weiter.
import webpush from 'web-push';

function env(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  const ime = import.meta.env as Record<string, string | undefined> | undefined;
  return ime ? ime[key] : undefined;
}

export function pushKonfiguriert(): boolean {
  return !!(env('VAPID_PUBLIC') && env('VAPID_PRIVATE'));
}
export function vapidPublic(): string {
  return env('VAPID_PUBLIC') ?? '';
}

let init = false;
function setup(): boolean {
  if (init) return true;
  const pub = env('VAPID_PUBLIC');
  const priv = env('VAPID_PRIVATE');
  if (!pub || !priv) return false;
  webpush.setVapidDetails(env('VAPID_SUBJECT') ?? 'mailto:admin@example.de', pub, priv);
  init = true;
  return true;
}

export interface PushAbo { endpoint: string; p256dh: string; auth: string }
export interface PushInhalt { titel: string; text: string; url?: string }

/**
 * Sendet eine Benachrichtigung an mehrere Abos. Liefert die Zahl der
 * Zustellungen und die Endpunkte, die dauerhaft weg sind (404/410) - diese
 * sollte der Aufrufer aus der DB entfernen.
 */
export async function sendePush(
  abos: PushAbo[],
  inhalt: PushInhalt,
): Promise<{ gesendet: number; tot: string[] }> {
  if (!setup()) return { gesendet: 0, tot: [] };
  const payload = JSON.stringify(inhalt);
  let gesendet = 0;
  const tot: string[] = [];
  for (const a of abos) {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, payload);
      gesendet++;
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) tot.push(a.endpoint);
    }
  }
  return { gesendet, tot };
}

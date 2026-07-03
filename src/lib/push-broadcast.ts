// Sendet eine Push-Benachrichtigung an ALLE hinterlegten Abos. Braucht einen
// PocketBase-Client, der die push_abos lesen darf (Vorstand). Tote Abos
// (404/410) werden gleich entfernt. Server-only.
import type PocketBase from 'pocketbase';
import { sendePush, pushKonfiguriert, type PushInhalt } from './push';

export async function pushAnAlle(pb: PocketBase, inhalt: PushInhalt): Promise<{ gesendet: number; tot: number }> {
  if (!pushKonfiguriert()) return { gesendet: 0, tot: 0 };
  let abos: Array<Record<string, any>> = [];
  try {
    abos = await pb.collection('push_abos').getFullList();
  } catch {
    return { gesendet: 0, tot: 0 };
  }
  const res = await sendePush(
    abos.map((a) => ({ endpoint: a.endpoint, p256dh: a.p256dh, auth: a.auth })),
    inhalt,
  );
  for (const a of abos) {
    if (res.tot.includes(a.endpoint)) {
      try {
        await pb.collection('push_abos').delete(a.id);
      } catch {
        /* egal */
      }
    }
  }
  return { gesendet: res.gesendet, tot: res.tot.length };
}

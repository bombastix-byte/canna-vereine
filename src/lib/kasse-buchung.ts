// Server-Helfer: bucht einen Aufnahmebeitrag als Kassen-Einnahme (Kategorie
// 'aufnahme'), optional einem Mitglied zugeordnet. Best-effort: scheitert die
// Buchung, bleibt die eigentliche Aktion (z. B. Mitglied anlegen) bestehen.
import type PocketBase from 'pocketbase';
import { euro } from './kasse';
import { berlinTag } from './ausgabe';

export async function bucheAufnahmebeitrag(
  pb: PocketBase,
  betrag: number,
  mitgliedId: string | undefined,
  vonId: string,
): Promise<boolean> {
  const b = euro(betrag);
  if (!(b > 0)) return false;
  try {
    await pb.collection('kassenbewegung').create({
      datum: berlinTag(),
      typ: 'aufnahme',
      betrag_euro: b,
      zweck: 'Aufnahmebeitrag',
      mitglied: mitgliedId || null,
      von: vonId,
    });
    return true;
  } catch {
    return false;
  }
}

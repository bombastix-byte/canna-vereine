// Server-Helfer: bucht einen Aufnahmebeitrag. Je nach Verein landet er in der
// internen Kasse (Kategorie 'aufnahme') und/oder wird als Barvorgang an eine
// externe Kasse zugestellt. Best-effort: scheitert die Buchung, bleibt die
// eigentliche Aktion (z. B. Mitglied anlegen) bestehen.
import type PocketBase from 'pocketbase';
import { euro } from './kasse';
import { berlinTag } from './ausgabe';
import { erfasseVorgang, type KonnektorConfig } from './kassen-konnektor';

export interface AufnahmeOpts {
  /** Interne Kasse aktiv? Dann Buchung in kassenbewegung (Default true). */
  kasseIntern?: boolean;
  /** Externe Kassen-Anbindung (falls konfiguriert). */
  kasseExtern?: KonnektorConfig;
}

export async function bucheAufnahmebeitrag(
  pb: PocketBase,
  betrag: number,
  mitgliedId: string | undefined,
  vonId: string,
  opts: AufnahmeOpts = {},
): Promise<boolean> {
  const b = euro(betrag);
  if (!(b > 0)) return false;
  const datum = berlinTag();

  // Interne Kasse (nur wenn Modul aktiv).
  if (opts.kasseIntern !== false) {
    try {
      await pb.collection('kassenbewegung').create({
        datum,
        typ: 'aufnahme',
        betrag_euro: b,
        zweck: 'Aufnahmebeitrag',
        mitglied: mitgliedId || null,
        von: vonId,
      });
    } catch {
      /* interne Buchung optional */
    }
  }

  // Barvorgang protokollieren + ggf. an externe Kasse zustellen.
  let mitgliedsnummer = '';
  if (mitgliedId) {
    try {
      mitgliedsnummer = (await pb.collection('users').getOne(mitgliedId)).mitgliedsnummer ?? '';
    } catch {
      mitgliedsnummer = '';
    }
  }
  await erfasseVorgang(pb, opts.kasseExtern, {
    art: 'aufnahme',
    mitglied: mitgliedId,
    mitgliedsnummer,
    betrag_euro: b,
    datum,
  }, vonId);

  return true;
}

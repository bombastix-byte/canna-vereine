// In-Prozess-Serialisierung je Schluessel (T5, SPEC-AUSGABE.md, fixt
// F4-Szenario A im Normalbetrieb). @astrojs/node laeuft als Einzelprozess,
// darum reicht eine simple In-Memory-Kette aus: zwei quasi-gleichzeitige
// Aufrufe mit demselben Schluessel (z. B. Mitglieds-ID) laufen strikt
// nacheinander, statt beide auf demselben veralteten Limit-/Bestandsstand zu
// pruefen. Bei Multi-Instanz-Betrieb ist das KEIN Ersatz fuer eine
// autoritative Datenbank-Grenze - dafuer sorgt der PB-Hook (T6,
// pb/pb_hooks/ausgaben.pb.js).
const ketten = new Map<string, Promise<unknown>>();

/** Fuehrt fn aus, serialisiert je Schluessel. Fehler brechen die Kette nicht. */
export async function inReihe<T>(schluessel: string, fn: () => Promise<T>): Promise<T> {
  const vorher = ketten.get(schluessel) ?? Promise.resolve();
  const lauf = vorher.then(fn, fn);
  // Aufraeumen: nur entfernen, wenn seither kein neuerer Aufruf angehaengt wurde.
  const platzhalter = lauf.then(
    () => {},
    () => {},
  );
  ketten.set(schluessel, platzhalter);
  try {
    return await lauf;
  } finally {
    if (ketten.get(schluessel) === platzhalter) ketten.delete(schluessel);
  }
}

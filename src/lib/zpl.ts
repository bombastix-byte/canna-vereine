// Erzeugt ZPL (Zebra Programming Language) fuer den Abgabe-Beleg / das Tueten-
// Etikett. ZPL koennen Zebra- und viele kompatible Etikettendrucker (TSC, Godex
// u. a.) direkt verarbeiten - i. d. R. per rohem Druck an TCP-Port 9100.
// Ausgelegt fuer eine ca. 62 mm breite Etikettenrolle.

export interface BelegPosition {
  sorte?: string;
  charge?: string;
  menge_gramm?: number;
  thc_prozent?: number;
  cbd_prozent?: number;
  beitrag_euro?: number;
}

export interface BelegDaten {
  verein: string;
  ort?: string;
  belegnr?: string;
  datum?: string;
  mitgliedsnummer?: string;
  /** Positionen des Vorgangs. Fehlt die Liste, gelten die Einzelfelder unten. */
  positionen?: BelegPosition[];
  sorte?: string;
  charge?: string;
  menge_gramm?: number;
  thc_prozent?: number;
  cbd_prozent?: number;
  beitrag_euro?: number;
}

// ZPL-Sonderzeichen (^ ~ \) entschaerfen, damit Feldinhalte nicht als Befehle gelten.
function z(s: unknown): string {
  return String(s ?? '').replace(/[\^~\\]/g, ' ');
}

/**
 * Baut ein ZPL-Etikett. Breite ~62 mm (496 dots bei 203 dpi). Reine Textzeilen,
 * bewusst nuechtern (KCanG: keine Werbung), inkl. Pflicht-/Warnhinweis.
 */
export function belegZpl(d: BelegDaten): string {
  const eur = (n?: number) => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const zeilen: string[] = [];
  let y = 20;
  const zeile = (text: string, opt: { fett?: boolean; hoehe?: number } = {}) => {
    const h = opt.hoehe ?? 24;
    const font = opt.fett ? `^A0N,${h + 6},${h + 6}` : `^A0N,${h},${h}`;
    zeilen.push(`^FO16,${y}${font}^FD${z(text)}^FS`);
    y += h + 8;
  };

  // Positionsliste; Einzelfelder dienen als Rueckfall (Altverhalten).
  const positionen: BelegPosition[] =
    d.positionen && d.positionen.length
      ? d.positionen
      : [{ sorte: d.sorte, charge: d.charge, menge_gramm: d.menge_gramm, thc_prozent: d.thc_prozent, cbd_prozent: d.cbd_prozent, beitrag_euro: d.beitrag_euro }];
  const gesamtG = positionen.reduce((s, p) => s + (Number(p.menge_gramm) || 0), 0);
  const gesamtEur = positionen.reduce((s, p) => s + (Number(p.beitrag_euro) || 0), 0);

  zeile(d.verein, { fett: true, hoehe: 28 });
  if (d.ort) zeile(d.ort, { hoehe: 20 });
  y += 6;
  zeile(`Beleg ${z(d.belegnr)}  ${z(d.datum)}`);
  zeile(`Mitglied ${z(d.mitgliedsnummer)}`);
  y += 4;
  for (const p of positionen) {
    zeile(`${z(p.sorte)}  (Charge ${z(p.charge)})`, { fett: true });
    zeile(`  ${z(p.menge_gramm)} g   THC ${z(p.thc_prozent)} %  CBD ${z(p.cbd_prozent)} %`);
  }
  y += 4;
  if (positionen.length > 1) zeile(`Gesamt ${z(gesamtG)} g`, { fett: true, hoehe: 28 });
  zeile(`Beitrag ${eur(gesamtEur)} EUR`, { fett: positionen.length === 1 });
  y += 6;
  zeile('Nur fuer Mitglieder. Weitergabe', { hoehe: 18 });
  zeile('verboten. Kein Verkauf. Konsum', { hoehe: 18 });
  zeile('unter 18 verboten. Fern von Kindern.', { hoehe: 18 });

  const hoehe = y + 20;
  return `^XA\n^CI28\n^PW496\n^LL${hoehe}\n${zeilen.join('\n')}\n^XZ\n`;
}

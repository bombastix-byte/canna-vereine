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

export interface PflanzenEtikett {
  verein?: string;
  charge?: string;
  sorte?: string;
  nummer: string;
}

/**
 * Kleines Pflanzen-Etikett (~50 mm) mit QR-Code (Inhalt = Pflanzennummer,
 * scanbar) und Klartext. Ein QR pro Pflanze zur eindeutigen Zuordnung.
 */
export function pflanzeZpl(d: PflanzenEtikett): string {
  const nr = z(d.nummer);
  const zeilen = [
    `^FO180,20^A0N,26,26^FD${z(d.sorte)}^FS`,
    `^FO180,54^A0N,30,30^FD${nr}^FS`,
    `^FO180,92^A0N,22,22^FDCharge ${z(d.charge)}^FS`,
    // QR links: ^BQN,2,6 -> Modell 2, Vergroesserung 6; FDLA, = normaler Text
    `^FO20,20^BQN,2,6^FDLA,${nr}^FS`,
  ];
  return `^XA\n^CI28\n^PW496\n^LL150\n${zeilen.join('\n')}\n^XZ\n`;
}

/** Alle Pflanzen-Etiketten einer Charge hintereinander (ein Druckauftrag). */
export function pflanzenZplStapel(pflanzen: PflanzenEtikett[]): string {
  return pflanzen.map(pflanzeZpl).join('');
}

export interface GebindeEtikett {
  verein?: string;
  /** QR-Inhalt: die Chargennummer - am Tresen scanbar (waehlt die Sorte). */
  chargeNr: string;
  sorte?: string;
  /** Produkt-Label, z. B. 'Blüte', 'Haschisch', 'Rosin'. */
  produkt?: string;
  thcProzent?: number | null;
}

/**
 * Gebinde-Etikett (~50 mm) fuer Abgabeglaeser/-tueten: QR = Chargennummer,
 * dazu Produkt, Sorte und THC. Der Tresen-Scanner waehlt darueber die Charge.
 */
export function gebindeZpl(d: GebindeEtikett): string {
  const nr = z(d.chargeNr);
  const kopf = [d.produkt, d.sorte].filter(Boolean).join(' · ');
  const fuss = [d.thcProzent != null ? `THC ${d.thcProzent} %` : '', d.verein ?? '']
    .filter(Boolean)
    .join(' · ');
  const zeilen = [
    `^FO180,20^A0N,26,26^FD${z(kopf)}^FS`,
    `^FO180,54^A0N,30,30^FD${nr}^FS`,
    `^FO180,92^A0N,22,22^FD${z(fuss)}^FS`,
    `^FO20,20^BQN,2,6^FDLA,${nr}^FS`,
  ];
  return `^XA\n^CI28\n^PW496\n^LL150\n${zeilen.join('\n')}\n^XZ\n`;
}

/** N gleiche Gebinde-Etiketten einer Charge (ein Druckauftrag). */
export function gebindeZplStapel(e: GebindeEtikett, anzahl: number): string {
  return Array.from({ length: Math.max(1, anzahl) }, () => gebindeZpl(e)).join('');
}

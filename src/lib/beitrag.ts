// Beitrags-/Mahnwesen: rechnet aus dem "bezahlt bis"-Datum und dem
// Monatsbeitrag den Zahlungsstatus eines Mitglieds. Bewusst monatsgenau
// (Kalendermonat), nicht taggenau - der Verein bucht pro Monat.

export interface BeitragMitglied {
  beitrag_monatlich?: number;
  beitrag_bis?: string; // YYYY-MM-DD: bezahlt bis einschliesslich dieses Monats
  mahnstufe?: number;
  gemahnt_am?: string;
}

export interface BeitragStatus {
  hatBeitrag: boolean; // Monatsbeitrag > 0 hinterlegt
  erfasst: boolean; // "bezahlt bis" gepflegt
  bisMonat: string | null; // YYYY-MM, bezahlt bis
  offeneMonate: number; // fehlende Monate bis einschliesslich aktuellem Monat
  offenerBetrag: number; // offeneMonate * Monatsbeitrag
  imRueckstand: boolean; // offeneMonate > 0
  mahnstufeVorschlag: number; // 0 ok, 1 Erinnerung, 2 1. Mahnung, 3 2. Mahnung
}

/** Jahr*12+Monat aus YYYY-MM(-DD). */
function ym(s: string): number {
  const [j, m] = s.split('-');
  return Number(j) * 12 + (Number(m) - 1);
}

/** Letzter Tag des Monats, der `monate` Monate nach dem bisher bezahlten Monat
 *  liegt, als YYYY-MM-DD. Ist noch nichts erfasst, zaehlt der Vormonat als
 *  Ausgangspunkt, sodass eine erste Zahlung von einem Monat den laufenden Monat
 *  deckt. Wer im Rueckstand ist, dessen "bezahlt bis" waechst genau um die
 *  gezahlten Monate (der Rest bleibt offen). */
export function beitragBisNach(bisAlt: string | undefined, heute: string, monate: number): string {
  const nowYM = ym(heute);
  const basis = bisAlt ? ym(bisAlt) : nowYM - 1;
  const ziel = basis + monate;
  const jahr = Math.floor(ziel / 12);
  const monat = (ziel % 12) + 1; // 1..12
  const letzterTag = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(letzterTag).padStart(2, '0')}`;
}

/** Vorgeschlagene Mahnstufe aus der Zahl offener Monate. */
export function mahnstufeAus(offeneMonate: number): number {
  if (offeneMonate <= 0) return 0;
  if (offeneMonate === 1) return 1; // Zahlungserinnerung
  if (offeneMonate === 2) return 2; // 1. Mahnung
  return 3; // 2. Mahnung
}

export function beitragStatus(u: BeitragMitglied, heute: string): BeitragStatus {
  const monat = Number(u.beitrag_monatlich) || 0;
  const hatBeitrag = monat > 0;
  const erfasst = !!u.beitrag_bis;
  const bisMonat = u.beitrag_bis ? u.beitrag_bis.slice(0, 7) : null;
  let offeneMonate = 0;
  if (hatBeitrag && erfasst) {
    offeneMonate = Math.max(0, ym(heute) - ym(u.beitrag_bis!));
  }
  return {
    hatBeitrag,
    erfasst,
    bisMonat,
    offeneMonate,
    offenerBetrag: Math.round(offeneMonate * monat * 100) / 100,
    imRueckstand: offeneMonate > 0,
    mahnstufeVorschlag: mahnstufeAus(offeneMonate),
  };
}

const MAHN_NAMEN = ['—', 'Zahlungserinnerung', '1. Mahnung', '2. Mahnung'];
export function mahnstufeName(stufe?: number): string {
  return MAHN_NAMEN[Math.min(Math.max(Number(stufe) || 0, 0), 3)];
}

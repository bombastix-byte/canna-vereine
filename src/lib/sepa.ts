// Erzeugt eine SEPA-Basislastschrift-Datei (pain.008.001.02) fuer die
// Mitgliedsbeitraege. Reine Funktionen, damit die Datei ohne Bank/Server
// pruefbar ist. Bewusst kein GoBD-Buchhaltungssystem - nur die Einzugsdatei,
// die der Vorstand bei der Bank einreicht. Geld/Buchung bleiben bei Bank/JTL.

export interface SepaGlaeubiger {
  name: string;
  iban: string;
  bic?: string;
  glaeubigerId: string;
}
export interface SepaMandat {
  name: string;
  iban: string;
  bic?: string;
  mandatsref: string;
  mandatsdatum: string; // 'YYYY-MM-DD'
  betragCent: number;
  endToEnd?: string;
}
export type SeqTyp = 'FRST' | 'RCUR' | 'OOFF' | 'FNAL';

function env(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  const ime = import.meta.env as Record<string, string | undefined> | undefined;
  return ime ? ime[key] : undefined;
}

/** Glaeubiger (Verein) aus der Server-Env; null wenn nicht konfiguriert. */
export function sepaGlaeubigerAusEnv(): SepaGlaeubiger | null {
  const name = env('SEPA_GLAEUBIGER_NAME');
  const iban = env('SEPA_GLAEUBIGER_IBAN');
  const glaeubigerId = env('SEPA_GLAEUBIGER_ID');
  if (!name || !iban || !glaeubigerId) return null;
  return { name, iban, bic: env('SEPA_GLAEUBIGER_BIC'), glaeubigerId };
}

/** IBAN: Grossbuchstaben, ohne Leerzeichen. */
export function normIban(s: string): string {
  return String(s ?? '').replace(/\s+/g, '').toUpperCase();
}

/** XML-Sonderzeichen escapen. */
export function xmlEsc(s: unknown): string {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** Namen SEPA-tauglich: erlaubter Zeichensatz, max. 70 Zeichen. */
export function sepaName(s: string): string {
  return String(s ?? '')
    .replace(/[^A-Za-z0-9/\-?:().,'+ äöüÄÖÜß]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 70);
}

/** Cent -> "12.34" (Punkt als Dezimaltrenner, wie SEPA verlangt). */
export function centStr(cent: number): string {
  return (Math.round(cent) / 100).toFixed(2);
}

export interface Pain008Eingabe {
  msgId: string;
  creDtTm: string; // ISO, z. B. 2026-07-03T09:00:00
  glaeubiger: SepaGlaeubiger;
  seqTyp: SeqTyp;
  ausfuehrungsdatum: string; // 'YYYY-MM-DD'
  verwendungszweck: string;
  mandate: SepaMandat[];
}

export interface Pain008Ergebnis {
  xml: string;
  anzahl: number;
  summeCent: number;
}

/** Baut die pain.008.001.02-XML. Wirft, wenn keine Mandate uebergeben werden. */
export function buildPain008(e: Pain008Eingabe): Pain008Ergebnis {
  if (!e.mandate.length) throw new Error('keine Mandate');
  const summeCent = e.mandate.reduce((s, m) => s + Math.round(m.betragCent), 0);
  const anzahl = e.mandate.length;
  const ctrl = centStr(summeCent);
  const pmtInfId = `PMT-${e.msgId}`;

  const bicOrOthr = (bic?: string) =>
    bic && bic.trim()
      ? `<FinInstnId><BIC>${xmlEsc(bic.trim().toUpperCase())}</BIC></FinInstnId>`
      : `<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>`;

  const tx = e.mandate
    .map((m, i) => {
      const e2e = sepaName(m.endToEnd || `${e.msgId}-${i + 1}`).replace(/\s/g, '');
      return (
        `<DrctDbtTxInf>` +
        `<PmtId><EndToEndId>${xmlEsc(e2e.slice(0, 35))}</EndToEndId></PmtId>` +
        `<InstdAmt Ccy="EUR">${centStr(m.betragCent)}</InstdAmt>` +
        `<DrctDbtTx><MndtRltdInf><MndtId>${xmlEsc(sepaName(m.mandatsref).slice(0, 35))}</MndtId>` +
        `<DtOfSgntr>${xmlEsc(m.mandatsdatum)}</DtOfSgntr></MndtRltdInf></DrctDbtTx>` +
        `<DbtrAgt>${bicOrOthr(m.bic)}</DbtrAgt>` +
        `<Dbtr><Nm>${xmlEsc(sepaName(m.name))}</Nm></Dbtr>` +
        `<DbtrAcct><Id><IBAN>${xmlEsc(normIban(m.iban))}</IBAN></Id></DbtrAcct>` +
        `<RmtInf><Ustrd>${xmlEsc(sepaName(e.verwendungszweck).slice(0, 140))}</Ustrd></RmtInf>` +
        `</DrctDbtTxInf>`
      );
    })
    .join('');

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<CstmrDrctDbtInitn>` +
    `<GrpHdr><MsgId>${xmlEsc(e.msgId)}</MsgId><CreDtTm>${xmlEsc(e.creDtTm)}</CreDtTm>` +
    `<NbOfTxs>${anzahl}</NbOfTxs><CtrlSum>${ctrl}</CtrlSum>` +
    `<InitgPty><Nm>${xmlEsc(sepaName(e.glaeubiger.name))}</Nm></InitgPty></GrpHdr>` +
    `<PmtInf><PmtInfId>${xmlEsc(pmtInfId)}</PmtInfId><PmtMtd>DD</PmtMtd>` +
    `<NbOfTxs>${anzahl}</NbOfTxs><CtrlSum>${ctrl}</CtrlSum>` +
    `<PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm>` +
    `<SeqTp>${e.seqTyp}</SeqTp></PmtTpInf>` +
    `<ReqdColltnDt>${xmlEsc(e.ausfuehrungsdatum)}</ReqdColltnDt>` +
    `<Cdtr><Nm>${xmlEsc(sepaName(e.glaeubiger.name))}</Nm></Cdtr>` +
    `<CdtrAcct><Id><IBAN>${xmlEsc(normIban(e.glaeubiger.iban))}</IBAN></Id></CdtrAcct>` +
    `<CdtrAgt>${bicOrOthr(e.glaeubiger.bic)}</CdtrAgt>` +
    `<ChrgBr>SLEV</ChrgBr>` +
    `<CdtrSchmeId><Id><PrvtId><Othr><Id>${xmlEsc(e.glaeubiger.glaeubigerId)}</Id>` +
    `<SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>` +
    tx +
    `</PmtInf></CstmrDrctDbtInitn></Document>\n`;

  return { xml, anzahl, summeCent };
}

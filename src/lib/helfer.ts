// Gemeinsame Logik fuer den Helferplan. Dienste sind Vorlagen mit Rhythmus;
// die konkreten Tagestermine werden daraus fuer einen Zeitraum berechnet.
// Genutzt von der Helferplan-Seite und vom Dashboard. Alle Datumsrechnungen in
// UTC, damit die Server-Zeitzone keine Verschiebung verursacht.

export interface Dienst {
  id: string;
  titel: string;
  rhythmus?: string;
  /** 1=Mo .. 7=So, nur bei rhythmus 'woechentlich' */
  wochentag?: number;
  /** 1..31, nur bei rhythmus 'monatlich' */
  monatstag?: number;
  /** ISO-Datum, nur bei rhythmus 'einmalig' */
  datum?: string;
  bedarf: number;
  beschreibung?: string;
  /** Verknuepfte Anleitung (Record-Id in `anleitungen`), optional. */
  anleitung?: string;
  /** Benoetigte Rolle ('anbau'/'ausgabe'/'vorstand'), leer = jedes Mitglied. */
  benoetigte_rolle?: string;
}

export interface Eintrag {
  id: string;
  mitglied: string;
  dienst: string;
  datum: string;
}

/** ISO-Wochentag (1=Montag .. 7=Sonntag). */
export function isoWochentag(d: Date): number {
  const j = d.getUTCDay();
  return j === 0 ? 7 : j;
}

/** 'YYYY-MM-DD' eines auf UTC-Mitternacht normierten Tages. */
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function plusTage(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

/** Normiert ein Datum auf UTC-Mitternacht (verwirft Uhrzeit). */
export function tagVon(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Montag der Woche, in der d liegt. */
export function montagVon(d: Date): Date {
  const t = tagVon(d);
  return plusTage(t, -(isoWochentag(t) - 1));
}

/** Parst 'YYYY-MM-DD' zu einem UTC-Mitternacht-Datum, sonst null. */
export function parseTag(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Findet der Dienst (Vorlage) an diesem Tag statt? */
export function findetStatt(dienst: Dienst, tag: Date): boolean {
  switch (dienst.rhythmus) {
    case 'taeglich':
      return true;
    case 'woechentlich':
      return dienst.wochentag === isoWochentag(tag);
    case 'monatlich':
      return dienst.monatstag === tag.getUTCDate();
    case 'einmalig':
      return !!dienst.datum && dienst.datum.slice(0, 10) === ymd(tag);
    default:
      return false;
  }
}

/** Anzahl Eintragungen fuer eine konkrete Vorlage an einem konkreten Tag. */
export function belegtAm(eintraege: Eintrag[], dienstId: string, tag: Date): number {
  const d = ymd(tag);
  return eintraege.filter((e) => e.dienst === dienstId && String(e.datum).slice(0, 10) === d).length;
}

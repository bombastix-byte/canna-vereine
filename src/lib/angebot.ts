import { berlinTag } from './ausgabe.ts';

export interface AngebotsSorte {
  name: string;
  typ?: string;
  thc?: string;
  cbd?: string;
}

export interface AngebotsDatensatz {
  id?: string;
  titel?: string;
  inhalt?: string;
  sorten?: AngebotsSorte[];
  gueltig_von?: string;
  gueltig_bis?: string;
}

const tag = (wert?: string): string => (wert ?? '').slice(0, 10);

/** Ein undatierter Eintrag gilt als aktuell; Datumsgrenzen sind inklusive. */
export function angebotIstAktuell(a: AngebotsDatensatz, heute = berlinTag()): boolean {
  const von = tag(a.gueltig_von);
  const bis = tag(a.gueltig_bis);
  return (!von || von <= heute) && (!bis || bis >= heute);
}

export function aktuelleAngebote<T extends AngebotsDatensatz>(angebote: T[], heute = berlinTag()): T[] {
  return angebote.filter((a) => angebotIstAktuell(a, heute));
}

export function sortenAusAngeboten(angebote: AngebotsDatensatz[], heute = berlinTag()): string[] {
  return [...new Set(
    aktuelleAngebote(angebote, heute)
      .flatMap((a) => a.sorten ?? [])
      .map((s) => String(s.name ?? '').trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b, 'de'));
}

/** Alte Testwerte nicht ungefiltert im Mitgliederbereich anzeigen. */
export function redaktionellerTitel(titel?: string): string {
  const wert = String(titel ?? '').trim();
  return !wert || /^test\s*\d*$/i.test(wert) ? 'Aktuelle Abgabe' : wert;
}

export function redaktionellerHinweis(inhalt?: string): string {
  const wert = String(inhalt ?? '').trim();
  return wert.length >= 10 ? wert : '';
}

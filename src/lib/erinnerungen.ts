// Erinnerungs-Automatik: reine Regeln, die aus dem Datenstand die fälligen
// Benachrichtigungen für einen Stichtag berechnen. Bewusst ohne Seiteneffekte
// (kein PocketBase, kein Push) -> testbar. Der Endpoint /api/erinnerungen ruft
// `berechneErinnerungen` und verschickt die Ergebnisse per Push.
import { beitragStatus } from './beitrag';
import { effektiverStatus } from './status';

export interface ErinnerungUser {
  id: string;
  mitgliedsnummer?: string;
  vorname?: string;
  nachname?: string;
  name?: string;
  geburtsdatum?: string;
  beitrag_monatlich?: number;
  beitrag_bis?: string;
  mitglied_status?: string;
  austritt_zum?: string;
}
export interface ErinnerungCharge {
  id: string;
  charge_nr?: string;
  sorte_name?: string;
  status?: string;
  ernte_datum?: string;
}

/** Ziel einer Erinnerung: ein bestimmtes Mitglied oder eine Personengruppe. */
export type Ziel = { art: 'mitglied'; mitgliedId: string } | { art: 'anbau' } | { art: 'personal' };

export interface Erinnerung {
  typ: 'beitrag' | 'trocknung' | 'u21';
  ziel: Ziel;
  titel: string;
  text: string;
  url?: string;
}

/** YYYY-MM-DD aus ISO/Datumsstring. */
function tag(s?: string): string {
  return s ? s.slice(0, 10) : '';
}

/** Ganze Tage von a nach b (b - a), beide YYYY-MM-DD. */
export function tageBis(a: string, b: string): number {
  const [ja, ma, ta] = a.split('-').map(Number);
  const [jb, mb, tb] = b.split('-').map(Number);
  const da = Date.UTC(ja, ma - 1, ta);
  const db = Date.UTC(jb, mb - 1, tb);
  return Math.round((db - da) / 86400000);
}

/** Tage seit dem Erntedatum bis heute (>= 0), oder null wenn kein Datum. */
export function tageSeitErnte(charge: ErinnerungCharge, heute: string): number | null {
  const e = tag(charge.ernte_datum);
  if (!e) return null;
  return tageBis(e, heute);
}

/** Wird das Mitglied in genau `tage` Tagen 21 (Geburtstag am Stichtag+tage)? */
export function wird21In(geburtsdatum: string | undefined, heute: string, tage: number): boolean {
  const g = tag(geburtsdatum);
  if (!g) return false;
  const [gj, gm, gt] = g.split('-').map(Number);
  const [, , ] = heute.split('-').map(Number);
  const jahr21 = gj + 21;
  const ziel = tag(heute);
  // Zieldatum = heute + tage
  const [hj, hm, ht] = ziel.split('-').map(Number);
  const zielD = new Date(Date.UTC(hj, hm - 1, ht + tage));
  return (
    zielD.getUTCFullYear() === jahr21 &&
    zielD.getUTCMonth() === gm - 1 &&
    zielD.getUTCDate() === gt
  );
}

const nameVon = (u: ErinnerungUser) =>
  u.mitgliedsnummer || [u.vorname, u.nachname].filter(Boolean).join(' ') || u.name || 'Mitglied';

export interface ErinnerungOpts {
  /** Tag im Monat, an dem Beitragserinnerungen laufen (Default 3.). */
  beitragTag?: number;
  /** Tage nach der Ernte für die Trocknungserinnerung (Default 10). */
  trocknungTage?: number;
  /** Vorlauf für die U21-Erinnerung (Default 30 Tage). */
  u21Vorlauf?: number;
}

/**
 * Berechnet alle für `heute` fälligen Erinnerungen. Die Regeln sind so
 * gewählt, dass sie bei täglichem Lauf jeweils genau einmal auslösen
 * (Schwellentag), damit nichts doppelt verschickt wird.
 */
export function berechneErinnerungen(
  users: ErinnerungUser[],
  chargen: ErinnerungCharge[],
  heute: string,
  opts: ErinnerungOpts = {},
): Erinnerung[] {
  const beitragTag = opts.beitragTag ?? 3;
  const trocknungTage = opts.trocknungTage ?? 10;
  const u21Vorlauf = opts.u21Vorlauf ?? 30;
  const erinnerungen: Erinnerung[] = [];

  // 1) Beitrag fällig — nur am festgelegten Monatstag, an aktive/gekündigte
  //    Mitglieder im Rückstand (ruhende/ausgetretene nicht behelligen).
  const heuteTag = Number(tag(heute).slice(8, 10));
  if (heuteTag === beitragTag) {
    for (const u of users) {
      const st = effektiverStatus(u, heute);
      if (st !== 'aktiv' && st !== 'gekuendigt') continue;
      const bs = beitragStatus(u, heute);
      if (bs.imRueckstand) {
        erinnerungen.push({
          typ: 'beitrag',
          ziel: { art: 'mitglied', mitgliedId: u.id },
          titel: 'Mitgliedsbeitrag offen',
          text: `Dein Beitrag ist ${bs.offeneMonate} Monat${bs.offeneMonate === 1 ? '' : 'e'} offen (${bs.offenerBetrag.toFixed(2)} €). Bitte im Verein begleichen.`,
          url: '/mitglieder/profil',
        });
      }
    }
  }

  // 2) Charge trocknungsreif — geerntete Charge, deren Ernte genau
  //    `trocknungTage` her ist. An das Anbau-Team.
  for (const c of chargen) {
    if (c.status !== 'geerntet') continue;
    if (tageSeitErnte(c, heute) === trocknungTage) {
      erinnerungen.push({
        typ: 'trocknung',
        ziel: { art: 'anbau' },
        titel: 'Charge trocknungsreif',
        text: `Charge ${c.charge_nr ?? ''} (${c.sorte_name ?? ''}) ist seit ${trocknungTage} Tagen in Trocknung — bitte Freigabe/Trockengewicht prüfen.`,
        url: '/mitglieder/wawi',
      });
    }
  }

  // 3) Mitglied wird bald 21 — U21-THC-Grenze endet in `u21Vorlauf` Tagen. An
  //    das Ausgabe-Team (Info, damit die Grenze angepasst wird).
  for (const u of users) {
    if (wird21In(u.geburtsdatum, heute, u21Vorlauf)) {
      erinnerungen.push({
        typ: 'u21',
        ziel: { art: 'personal' },
        titel: 'U21-Grenze endet bald',
        text: `Mitglied ${nameVon(u)} wird in ${u21Vorlauf} Tagen 21 — ab dann gilt keine verschärfte THC-Grenze mehr.`,
        url: '/mitglieder/ausgabe',
      });
    }
  }

  return erinnerungen;
}

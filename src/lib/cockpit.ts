// Vorstands-Cockpit: bündelt die wichtigsten Kennzahlen für die Startseite.
// Nutzt möglichst günstige Abfragen (getList totalItems für reine Zählungen)
// und lädt nur dort volle Listen, wo pro Zeile gerechnet werden muss.
import type PocketBase from 'pocketbase';
import { beitragStatus } from './beitrag';

export interface Kennzahlen {
  mitglieder: number;
  rueckstandZahl: number;
  rueckstandSumme: number;
  bestandG: number;
  abgabe7G: number;
  antraegeOffen: number;
  rueckrufeAktiv: number;
  kasseOffen: boolean; // heute noch kein Tagesabschluss
  kasseErwartet: number; // erwartete Bareinnahme heute
}

/** YYYY-MM-DD, `tage` Tage vor `heute` (heute im Format YYYY-MM-DD). */
export function tagMinus(heute: string, tage: number): string {
  const [j, m, t] = heute.split('-').map(Number);
  const d = new Date(Date.UTC(j, m - 1, t - tage));
  return d.toISOString().slice(0, 10);
}

async function anzahl(pb: PocketBase, collection: string, filter: string): Promise<number> {
  try {
    const r = await pb.collection(collection).getList(1, 1, { filter, fields: 'id' });
    return r.totalItems;
  } catch {
    return 0;
  }
}

async function alle<T = Record<string, any>>(pb: PocketBase, collection: string, opts: Record<string, unknown> = {}): Promise<T[]> {
  try {
    return (await pb.collection(collection).getFullList(opts)) as T[];
  } catch {
    return [];
  }
}

export async function vorstandsKennzahlen(pb: PocketBase, heute: string, hatBeitraege = true): Promise<Kennzahlen> {
  // Mitglieder gesamt (ohne technisches System-/Automatik-Konto).
  const mitglieder = await anzahl(pb, 'users', 'mitgliedsnummer != "SYS"');

  // Beitragsrückstände (pro Mitglied rechnen) — nur wenn das Beitrags-Modul aktiv ist.
  let rueckstandZahl = 0;
  let rueckstandSumme = 0;
  if (hatBeitraege) {
    const beitragsUser = await alle<{ beitrag_monatlich?: number; beitrag_bis?: string }>(pb, 'users', {
      filter: 'beitrag_monatlich > 0',
      fields: 'beitrag_monatlich,beitrag_bis',
    });
    for (const u of beitragsUser) {
      const st = beitragStatus(u, heute);
      if (st.imRueckstand) {
        rueckstandZahl += 1;
        rueckstandSumme += st.offenerBetrag;
      }
    }
    rueckstandSumme = Math.round(rueckstandSumme * 100) / 100;
  }

  // Freigegebener Bestand (Summe verfügbar).
  const freigegeben = await alle<{ verfuegbar_g?: number }>(pb, 'chargen', {
    filter: 'status = "freigegeben"',
    fields: 'verfuegbar_g',
  });
  const bestandG = Math.round(freigegeben.reduce((s, c) => s + (Number(c.verfuegbar_g) || 0), 0) * 10) / 10;

  // Abgegeben in den letzten 7 Tagen (ohne Stornos).
  const ab = tagMinus(heute, 6); // heute + 6 Vortage = 7 Tage
  const abgaben = await alle<{ menge_gramm?: number }>(pb, 'ausgaben', {
    filter: `tag >= "${ab}" && storniert != true`,
    fields: 'menge_gramm',
  });
  const abgabe7G = Math.round(abgaben.reduce((s, a) => s + (Number(a.menge_gramm) || 0), 0) * 10) / 10;

  // Offene Anträge (offen + Warteliste).
  const antraegeOffen = await anzahl(pb, 'antraege', 'status = "offen" || status = "warteliste"');

  // Aktive Rückrufe.
  const rueckrufeAktiv = await anzahl(pb, 'chargen', 'rueckruf = true');

  // Kasse heute: erwartete Bareinnahme + ob schon abgeschlossen.
  const heuteAbgaben = await alle<{ beitrag_euro?: number }>(pb, 'ausgaben', {
    filter: `tag = "${heute}" && storniert != true`,
    fields: 'beitrag_euro',
  });
  const bewegungen = await alle<{ typ?: string; betrag_euro?: number }>(pb, 'kassenbewegung', {
    filter: `datum = "${heute}"`,
    fields: 'typ,betrag_euro',
  });
  const beitraege = heuteAbgaben.reduce((s, a) => s + (Number(a.beitrag_euro) || 0), 0);
  const einlagen = bewegungen.filter((b) => b.typ === 'einlage').reduce((s, b) => s + (Number(b.betrag_euro) || 0), 0);
  const entnahmen = bewegungen.filter((b) => b.typ === 'entnahme').reduce((s, b) => s + (Number(b.betrag_euro) || 0), 0);
  const kasseErwartet = Math.round((beitraege + einlagen - entnahmen) * 100) / 100;
  const kasseOffen = (await anzahl(pb, 'kassenabschluss', `datum = "${heute}"`)) === 0;

  return {
    mitglieder,
    rueckstandZahl,
    rueckstandSumme,
    bestandG,
    abgabe7G,
    antraegeOffen,
    rueckrufeAktiv,
    kasseOffen,
    kasseErwartet,
  };
}

// Kassen-Konnektor: leitet Barvorgänge (Abgabe-Beitrag, Aufnahmebeitrag) an eine
// externe Kassensoftware weiter. Bewusst generisch: ein normalisiertes JSON wird
// per Webhook an eine konfigurierbare URL geschickt — so lässt sich JEDE externe
// Kasse anbinden (direkt, falls sie Webhooks kann, oder über eine kleine
// Middleware, z. B. für JTL). Jeder Vorgang wird zusätzlich dauerhaft in
// `kassenvorgaenge` protokolliert (auch wenn kein Konnektor aktiv ist), damit
// nichts verloren geht und man erneut zustellen kann.
import type PocketBase from 'pocketbase';
import { site } from '../config';

export type KonnektorTyp = 'keiner' | 'webhook' | 'jtl';
export interface KonnektorConfig {
  typ: KonnektorTyp;
  url?: string;
  token?: string;
}

export function konnektorAktiv(cfg?: KonnektorConfig): boolean {
  return !!cfg && (cfg.typ === 'webhook' || cfg.typ === 'jtl') && !!cfg.url;
}

export interface VorgangPosition {
  bezeichnung: string;
  menge_g?: number;
  betrag_euro: number;
}
export interface Vorgang {
  art: 'abgabe' | 'aufnahme';
  belegnr?: string;
  mitglied?: string;
  mitgliedsnummer?: string;
  betrag_euro: number;
  datum: string;
  positionen?: VorgangPosition[];
}

/** Sendet einen Vorgang an die externe Kasse. Wirft nie. */
async function sendeExtern(cfg: KonnektorConfig, v: Vorgang): Promise<{ ok: boolean; status: number; antwort: string }> {
  if (!konnektorAktiv(cfg)) return { ok: false, status: 0, antwort: 'kein Konnektor' };
  const payload = {
    quelle: 'CVMS',
    verein: site.id,
    typ: cfg.typ,
    art: v.art,
    belegnr: v.belegnr ?? '',
    mitgliedsnummer: v.mitgliedsnummer ?? '',
    datum: v.datum,
    betrag_euro: v.betrag_euro,
    positionen: v.positionen ?? [],
  };
  try {
    const res = await fetch(cfg.url as string, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cfg.token ? { authorization: `Bearer ${cfg.token}` } : {}),
        'x-kasse-konnektor': cfg.typ,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    const text = (await res.text()).slice(0, 500);
    return { ok: res.ok, status: res.status, antwort: text };
  } catch (e) {
    return { ok: false, status: 0, antwort: String((e as Error)?.message ?? e).slice(0, 300) };
  }
}

/**
 * Protokolliert einen Barvorgang dauerhaft und stellt ihn — falls ein Konnektor
 * aktiv ist — an die externe Kasse zu. Best-effort: scheitert nie hart.
 */
export async function erfasseVorgang(
  pb: PocketBase,
  cfg: KonnektorConfig | undefined,
  v: Vorgang,
  vonId: string,
): Promise<void> {
  const aktiv = konnektorAktiv(cfg);
  let status: 'offen' | 'gesendet' | 'fehler' | 'lokal' = aktiv ? 'offen' : 'lokal';
  let antwort = '';
  if (aktiv) {
    const r = await sendeExtern(cfg as KonnektorConfig, v);
    status = r.ok ? 'gesendet' : 'fehler';
    antwort = `${r.status} ${r.antwort}`.trim();
  }
  try {
    await pb.collection('kassenvorgaenge').create({
      art: v.art,
      mitglied: v.mitglied || null,
      mitgliedsnummer: v.mitgliedsnummer ?? '',
      belegnr: v.belegnr ?? '',
      positionen: v.positionen ?? [],
      betrag_euro: v.betrag_euro,
      datum: v.datum,
      extern_status: status,
      extern_antwort: antwort,
      von: vonId,
    });
  } catch {
    /* Protokollzeile ist Zusatz; die eigentliche Abgabe bleibt gültig */
  }
}

/** Erneuter Zustellversuch eines vorhandenen Vorgangs (Retry-Aktion). */
export async function sendeVorgangErneut(
  pb: PocketBase,
  cfg: KonnektorConfig | undefined,
  row: Record<string, any>,
): Promise<boolean> {
  if (!konnektorAktiv(cfg)) return false;
  const r = await sendeExtern(cfg as KonnektorConfig, {
    art: row.art,
    belegnr: row.belegnr,
    mitgliedsnummer: row.mitgliedsnummer,
    betrag_euro: Number(row.betrag_euro) || 0,
    datum: row.datum,
    positionen: row.positionen ?? [],
  });
  try {
    await pb.collection('kassenvorgaenge').update(row.id, {
      extern_status: r.ok ? 'gesendet' : 'fehler',
      extern_antwort: `${r.status} ${r.antwort}`.trim(),
    });
  } catch {
    /* egal */
  }
  return r.ok;
}

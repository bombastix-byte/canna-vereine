// Änderungshistorie / Audit-Log. Ein einziger Einstiegspunkt `protokolliere`,
// den die schreibenden Endpoints aufrufen. Best-effort: ein Fehler beim
// Protokollieren darf die eigentliche Aktion nie scheitern lassen.
import type PocketBase from 'pocketbase';

export interface Akteur {
  id: string;
  name?: string;
  vorname?: string;
  nachname?: string;
  mitgliedsnummer?: string;
}

export interface AuditDetails {
  objektTyp?: string;
  objektId?: string;
  objektLabel?: string;
  /** Frei lesbarer Zusatz (z. B. geänderte Felder, Betrag, Grund). */
  details?: string;
}

function akteurName(a: Akteur): string {
  return [a.vorname, a.nachname].filter(Boolean).join(' ') || a.name || a.mitgliedsnummer || a.id;
}

/**
 * Schreibt eine Protokollzeile. Wirft nie. Rückgabe zeigt nur an, ob es geklappt
 * hat (für Tests), wird von Endpoints aber ignoriert.
 */
export async function protokolliere(
  pb: PocketBase,
  akteur: Akteur,
  aktion: string,
  d: AuditDetails = {},
): Promise<boolean> {
  try {
    await pb.collection('audit_log').create({
      akteur: akteur.id,
      akteur_name: akteurName(akteur),
      aktion,
      objekt_typ: d.objektTyp ?? '',
      objekt_id: d.objektId ?? '',
      objekt_label: d.objektLabel ?? '',
      details: d.details ?? '',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Vergleicht alt/neu über die angegebenen Felder und liefert eine kurze,
 * menschenlesbare Änderungsbeschreibung (ohne die Werte sensibler Felder zu
 * spammen). Leerer String, wenn nichts Relevantes geändert wurde.
 */
export function feldDiff(
  alt: Record<string, any>,
  neu: Record<string, any>,
  felder: { key: string; label: string }[],
): string {
  const teile: string[] = [];
  for (const f of felder) {
    const a = normalize(alt[f.key]);
    const n = normalize(neu[f.key]);
    if (a !== n) teile.push(f.label);
  }
  return teile.length ? `geändert: ${teile.join(', ')}` : '';
}

function normalize(v: any): string {
  if (v == null) return '';
  if (Array.isArray(v)) return [...v].sort().join(',');
  return String(v).trim();
}

/** Kurzlabel für die Anzeige einer Aktion im Protokoll. */
export const AKTION_LABEL: Record<string, string> = {
  'mitglied.angelegt': 'Mitglied angelegt',
  'mitglied.aktualisiert': 'Mitglied bearbeitet',
  'mitglied.geloescht': 'Mitglied gelöscht',
  'mitglied.status': 'Status geändert',
  'rolle.geaendert': 'Rollen geändert',
  'antrag.aufgenommen': 'Antrag aufgenommen',
  'antrag.abgelehnt': 'Antrag abgelehnt',
  'charge.freigegeben': 'Charge freigegeben',
  'charge.gesperrt': 'Charge gesperrt',
  'charge.rueckruf': 'Charge zurückgerufen',
  'abgabe.storniert': 'Abgabe storniert',
  'zahlung.erfasst': 'Zahlung erfasst',
  'mahnung.gesendet': 'Mahnung gesendet',
};

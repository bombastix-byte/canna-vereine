// Logik der Anbau-Plaene: Zyklustag, Phasen, faellige Pflege-/Duengeschritte.
// Ein Plan ist ein Schema aus Schritten je Zyklustag ("Tag 25: Topping",
// "ab Tag 14 alle 3 Tage: Wuchsduenger"). Reine Funktionen, testbar.

export interface PlanSchritt {
  id: string;
  plan: string;
  /** Zyklustag (1-basiert), ab dem der Schritt faellig ist. */
  tag_von: number;
  titel: string;
  /** phase = Abschnittsmarker; pflege/duengung/kontrolle = Aufgaben. */
  typ?: 'phase' | 'pflege' | 'duengung' | 'kontrolle' | string;
  /** z. B. Duengemischung "BioGrow 2 ml/L, EC 1,2". */
  details?: string;
  /** Alle N Tage wiederholen (ab tag_von); leer/0 = einmalig. */
  wiederholung_tage?: number;
  /** Verknuepfte Anleitung (SOP) - "so wird es gemacht". */
  anleitung?: string;
}

export interface PflegeEintrag {
  charge_ref: string;
  schritt: string;
  /** Zyklustag, fuer den der Schritt erledigt wurde (wichtig bei Wiederholung). */
  zyklustag: number;
}

/** Zyklustag (1-basiert) aus Anbaubeginn und heutigem Tag ('YYYY-MM-DD'). */
export function zyklustag(anbauStart: string | undefined, heute: string): number | null {
  const s = /^(\d{4})-(\d{2})-(\d{2})/.exec(anbauStart ?? '');
  const h = /^(\d{4})-(\d{2})-(\d{2})/.exec(heute);
  if (!s || !h) return null;
  const start = Date.UTC(Number(s[1]), Number(s[2]) - 1, Number(s[3]));
  const jetzt = Date.UTC(Number(h[1]), Number(h[2]) - 1, Number(h[3]));
  const tage = Math.floor((jetzt - start) / 86400000) + 1;
  return tage >= 1 ? tage : null;
}

/** Aktuelle Phase = letzter Phasen-Marker, dessen Tag erreicht ist. */
export function aktuellePhase(schritte: PlanSchritt[], tag: number): PlanSchritt | null {
  const phasen = schritte
    .filter((s) => s.typ === 'phase' && s.tag_von <= tag)
    .sort((a, b) => a.tag_von - b.tag_von);
  return phasen.length ? phasen[phasen.length - 1] : null;
}

/** Ist ein Schritt an diesem Zyklustag faellig (einmalig oder Wiederholung)? */
export function istFaelligAm(s: PlanSchritt, tag: number): boolean {
  if (s.typ === 'phase') return false;
  const w = Number(s.wiederholung_tage) || 0;
  if (w > 0) return tag >= s.tag_von && (tag - s.tag_von) % w === 0;
  return tag === s.tag_von;
}

export interface FaelligerSchritt {
  schritt: PlanSchritt;
  /** Zyklustag, an dem der Schritt faellig war/ist. */
  faelligTag: number;
  /** 0 = heute faellig, >0 = so viele Tage ueberfaellig. */
  ueberfaelligTage: number;
}

/**
 * Offene Aufgaben bis einschliesslich heute: einmalige Schritte, die seit
 * ihrem Tag nicht erledigt wurden (ueberfaellig bleibt sichtbar), und
 * Wiederholungs-Schritte fuer das JUENGSTE faellige Vorkommen.
 */
export function offeneSchritte(
  schritte: PlanSchritt[],
  erledigt: PflegeEintrag[],
  chargeId: string,
  tag: number,
): FaelligerSchritt[] {
  const istErledigt = (schrittId: string, faelligTag: number) =>
    erledigt.some((e) => e.charge_ref === chargeId && e.schritt === schrittId && e.zyklustag === faelligTag);
  const out: FaelligerSchritt[] = [];
  for (const s of schritte) {
    if (s.typ === 'phase' || s.tag_von > tag) continue;
    const w = Number(s.wiederholung_tage) || 0;
    if (w > 0) {
      // Juengstes faelliges Vorkommen <= heute.
      const letzte = s.tag_von + Math.floor((tag - s.tag_von) / w) * w;
      if (!istErledigt(s.id, letzte)) {
        out.push({ schritt: s, faelligTag: letzte, ueberfaelligTage: tag - letzte });
      }
    } else if (!istErledigt(s.id, s.tag_von)) {
      out.push({ schritt: s, faelligTag: s.tag_von, ueberfaelligTage: tag - s.tag_von });
    }
  }
  return out.sort((a, b) => b.ueberfaelligTage - a.ueberfaelligTage);
}

/** Naechste anstehende Schritte (Vorschau: was kommt in den naechsten Tagen). */
export function kommendeSchritte(schritte: PlanSchritt[], tag: number, horizontTage = 7): Array<{ schritt: PlanSchritt; inTagen: number }> {
  const out: Array<{ schritt: PlanSchritt; inTagen: number }> = [];
  for (const s of schritte) {
    if (s.typ === 'phase') continue;
    const w = Number(s.wiederholung_tage) || 0;
    let naechster: number | null = null;
    if (w > 0) {
      naechster = s.tag_von > tag ? s.tag_von : s.tag_von + (Math.floor((tag - s.tag_von) / w) + 1) * w;
    } else if (s.tag_von > tag) {
      naechster = s.tag_von;
    }
    if (naechster !== null && naechster - tag <= horizontTage) {
      out.push({ schritt: s, inTagen: naechster - tag });
    }
  }
  return out.sort((a, b) => a.inTagen - b.inTagen);
}

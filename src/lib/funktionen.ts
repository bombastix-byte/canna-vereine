// Zentrale Auswertung der abschaltbaren Funktions-Module des aktiven Vereins.
// Ein Modul ist AN, solange es nicht ausdrücklich auf false steht.
import { site } from '../config';
import type { FunktionsSchluessel } from '../config/types';

/** Generisch: Ist das Modul für diesen Verein aktiv? (Default: ja) */
export function modulAktiv(key: FunktionsSchluessel): boolean {
  return site.funktionen?.[key] !== false;
}

// Bequeme benannte Flags (build-fest, ein Wert je Verein/Build).
export const hatBeitraege = modulAktiv('beitraege');
export const hatVerarbeitung = modulAktiv('verarbeitung');
export const hatKasse = modulAktiv('kasse');
export const hatVorbestellung = modulAktiv('vorbestellung');
export const hatTermine = modulAktiv('termine');
export const hatHelferplan = modulAktiv('helferplan');
export const hatAbstimmungen = modulAktiv('abstimmungen');
export const hatAntraege = modulAktiv('antraege');
export const hatPush = modulAktiv('push');

/** Konfigurierter Aufnahmebeitrag in Euro (0 = keiner). */
export const aufnahmebeitragEuro: number = Math.max(0, Number(site.aufnahmebeitrag_euro) || 0);

/** Nutzt der Verein einen Aufnahmebeitrag? */
export const hatAufnahmebeitrag: boolean = aufnahmebeitragEuro > 0;

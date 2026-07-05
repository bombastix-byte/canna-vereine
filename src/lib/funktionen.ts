// Zentrale Auswertung der abschaltbaren Funktions-Module des aktiven Vereins.
// Ein Modul ist AN, solange es nicht ausdrücklich auf false steht.
import { site } from '../config';

/** Laufende Beiträge / SEPA / Mahnwesen aktiv für diesen Verein? */
export const hatBeitraege: boolean = site.funktionen?.beitraege !== false;

/** Konfigurierter Aufnahmebeitrag in Euro (0 = keiner). */
export const aufnahmebeitragEuro: number = Math.max(0, Number(site.aufnahmebeitrag_euro) || 0);

/** Nutzt der Verein einen Aufnahmebeitrag? */
export const hatAufnahmebeitrag: boolean = aufnahmebeitragEuro > 0;

// Reine Geldrechnung fuer das Kassenbuch (Cent-genau gerundet).

export function euro(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function euroText(n: number): string {
  return euro(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

/**
 * Erwartete Bareinnahme des Tages: Abgabe-Beitraege + Aufnahmebeitraege +
 * Einlagen - Entnahmen. `aufnahmen` ist optional (Vereine ohne Aufnahmebeitrag).
 */
export function erwarteteEinnahme(
  beitraege: number,
  einlagen: number,
  entnahmen: number,
  aufnahmen = 0,
): number {
  return euro(euro(beitraege) + euro(aufnahmen) + euro(einlagen) - euro(entnahmen));
}

/** Differenz gezaehlt - erwartet (positiv = Ueberschuss, negativ = Fehlbetrag). */
export function differenz(gezaehlt: number, erwartet: number): number {
  return euro(euro(gezaehlt) - euro(erwartet));
}

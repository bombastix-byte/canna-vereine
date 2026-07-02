// Kleine CSV-Helfer fuer die Behoerden-/Protokoll-Exporte.
// Semikolon als Trenner (deutsches Excel oeffnet das direkt korrekt),
// UTF-8 mit BOM, damit Umlaute in Excel stimmen.

export const CSV_TRENNER = ';';
export const CSV_BOM = '﻿';

/** Ein Feld CSV-sicher machen (Anfuehrungszeichen, Trenner, Zeilenumbrueche). */
export function csvFeld(wert: unknown): string {
  const s = wert == null ? '' : String(wert);
  if (s.includes(CSV_TRENNER) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replaceAll('"', '""') + '"';
  }
  return s;
}

/** Zeilen (Arrays) zu einem CSV-Text inkl. BOM zusammensetzen. */
export function csvText(zeilen: unknown[][]): string {
  return CSV_BOM + zeilen.map((z) => z.map(csvFeld).join(CSV_TRENNER)).join('\r\n') + '\r\n';
}

/** Fertige Download-Response fuer eine CSV-Datei. */
export function csvAntwort(dateiname: string, zeilen: unknown[][]): Response {
  return new Response(csvText(zeilen), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${dateiname}"`,
    },
  });
}

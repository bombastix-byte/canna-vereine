// Sofortige, gebrandete Weiterleitung ohne sichtbare Zwischenseite. Ersetzt
// Astros Standard-Redirect-Stub (weisse Seite mit 2-Sekunden-Meta-Refresh).
// Funktioniert in statischen wie serverseitigen Builds gleichermassen.

// Hintergrundfarbe je Theme, damit die (sehr kurze) Weiterleitungsseite
// nahtlos in die Zielseite uebergeht - kein weisses Aufblitzen.
const THEME_BG: Record<string, string> = {
  nacht: '#151a18',
  botanik: '#f6f7f3',
  klar: '#ffffff',
  warm: '#faf6ef',
};

export function redirectSplash(ziel: string, theme?: string): Response {
  const bg = THEME_BG[theme ?? ''] ?? '#151a18';
  const zielJson = JSON.stringify(ziel);
  const html =
    `<!doctype html><html lang="de"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="robots" content="noindex, nofollow">` +
    `<meta http-equiv="refresh" content="0; url=${ziel}">` +
    `<title>Mitgliederbereich</title>` +
    `<style>html,body{margin:0;height:100%;background:${bg}}</style>` +
    // location.replace: keine History-Eintraege -> der Zurueck-Knopf springt
    // nicht auf die Weiterleitungsseite zurueck.
    `<script>location.replace(${zielJson})</script></head><body></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

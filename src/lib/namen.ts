// Zerlegt einen Mitgliedsnamen in Vor- und Nachname. Explizit gepflegte
// Felder (vorname/nachname) haben Vorrang; sonst wird `name` aufgeteilt:
// letztes Token = Nachname, vorangestellte Namenspartikel (von, de, van …)
// bleiben beim Nachnamen. Fuer die getrennte Anzeige auf dem Ausweis.

const PARTIKEL = new Set([
  'von', 'van', 'vom', 'zu', 'zur', 'zum', 'de', 'del', 'della', 'di', 'da',
  'der', 'den', 'la', 'le', 'los', 'af', 'av', 'ter', 'ten',
]);

export interface NamensFelder {
  name?: string;
  vorname?: string;
  nachname?: string;
}

export function namensteile(m: NamensFelder): { vorname: string; nachname: string } {
  const v = (m.vorname ?? '').trim();
  const n = (m.nachname ?? '').trim();
  if (v || n) return { vorname: v, nachname: n };

  const teile = (m.name ?? '').trim().split(/\s+/).filter(Boolean);
  if (teile.length === 0) return { vorname: '', nachname: '' };
  if (teile.length === 1) return { vorname: '', nachname: teile[0] };

  // Nachname = letztes Token, ggf. mit vorangestellten Partikeln.
  let i = teile.length - 1;
  while (i > 1 && PARTIKEL.has(teile[i - 1].toLowerCase())) i--;
  return { vorname: teile.slice(0, i).join(' '), nachname: teile.slice(i).join(' ') };
}

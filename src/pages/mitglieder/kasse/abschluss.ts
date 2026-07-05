import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAusgeben } from '../../../lib/rollen';
import { berlinTag } from '../../../lib/ausgabe';
import { euro, erwarteteEinnahme, differenz } from '../../../lib/kasse';

// Tagesabschluss: rechnet die erwartete Bareinnahme des Tages SERVERSEITIG
// (Beitraege + Einlagen - Entnahmen) und haelt sie gegen die gezaehlte
// Summe. Ein Abschluss je Tag. Nur Ausgabe/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAusgeben(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const gezaehlt = euro(Number(String(daten.get('gezaehlt_euro') ?? '').replace(',', '.')));
  const notiz = String(daten.get('notiz') ?? '').trim();
  const tag = berlinTag();

  // Schon abgeschlossen?
  try {
    await pb.collection('kassenabschluss').getFirstListItem(`datum="${tag}"`);
    return redirect('/mitglieder/kasse?fehler=schon', 303);
  } catch {
    /* noch offen - gut */
  }

  async function liste(collection: string, filter: string): Promise<Array<Record<string, any>>> {
    try {
      return await pb.collection(collection).getFullList({ filter });
    } catch {
      return [];
    }
  }

  const abgaben = await liste('ausgaben', `tag="${tag}" && storniert!=true`);
  const beitraege = euro(abgaben.reduce((s, a) => s + (Number(a.beitrag_euro) || 0), 0));
  const bewegungen = await liste('kassenbewegung', `datum="${tag}"`);
  const einlagen = euro(bewegungen.filter((b) => b.typ === 'einlage').reduce((s, b) => s + (Number(b.betrag_euro) || 0), 0));
  const entnahmen = euro(bewegungen.filter((b) => b.typ === 'entnahme').reduce((s, b) => s + (Number(b.betrag_euro) || 0), 0));
  const aufnahmen = euro(bewegungen.filter((b) => b.typ === 'aufnahme').reduce((s, b) => s + (Number(b.betrag_euro) || 0), 0));
  const erwartet = erwarteteEinnahme(beitraege, einlagen, entnahmen, aufnahmen);

  try {
    await pb.collection('kassenabschluss').create({
      datum: tag,
      beitraege_euro: beitraege,
      einlagen_euro: einlagen,
      entnahmen_euro: entnahmen,
      erwartet_euro: erwartet,
      gezaehlt_euro: gezaehlt,
      differenz_euro: differenz(gezaehlt, erwartet),
      notiz,
      von: mitglied.id,
    });
  } catch {
    return redirect('/mitglieder/kasse?fehler=fehlgeschlagen', 303);
  }
  return redirect('/mitglieder/kasse?ok=abschluss', 303);
};

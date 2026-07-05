import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten } from '../../../lib/rollen';
import { berlinTag } from '../../../lib/ausgabe';
import { beitragBisNach } from '../../../lib/beitrag';

// Zahlung eines Mitgliedsbeitrags erfassen: schreibt eine Journal-Zeile
// (append-only) und schiebt "bezahlt bis" um die gezahlten Monate vor. Eine
// Zahlung setzt eine offene Mahnung zurueck. Nur Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const mitgliedId = String(daten.get('mitglied') ?? '').trim();
  const betrag = Math.round(Number(String(daten.get('betrag_euro') ?? '').replace(',', '.')) * 100) / 100;
  const monate = Math.max(1, Math.round(Number(daten.get('monate') ?? '1')) || 1);
  const methode = String(daten.get('methode') ?? 'bar');
  const notiz = String(daten.get('notiz') ?? '').trim();
  if (!mitgliedId || !(betrag > 0)) {
    return redirect('/mitglieder/beitraege/status?fehler=eingabe', 303);
  }

  let u;
  try {
    u = await pb.collection('users').getOne(mitgliedId);
  } catch {
    return redirect('/mitglieder/beitraege/status?fehler=unbekannt', 303);
  }

  const heute = berlinTag();
  const neuBis = beitragBisNach(u.beitrag_bis, heute, monate);

  try {
    await pb.collection('zahlungen').create({
      mitglied: mitgliedId,
      datum: heute,
      betrag_euro: betrag,
      monate,
      methode,
      zeitraum_bis: neuBis,
      notiz,
      von: mitglied.id,
    });
    await pb.collection('users').update(mitgliedId, {
      beitrag_bis: neuBis,
      mahnstufe: 0,
      gemahnt_am: '',
    });
  } catch {
    return redirect('/mitglieder/beitraege/status?fehler=fehlgeschlagen', 303);
  }
  return redirect('/mitglieder/beitraege/status?ok=zahlung', 303);
};

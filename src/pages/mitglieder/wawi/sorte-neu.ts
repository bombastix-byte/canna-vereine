import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';
import { protokolliere } from '../../../lib/audit';

// Legt eine neue Sorte an (Stammdaten-Katalog). Nur Anbau/Vorstand.
// THC/CBD sind die erwarteten Richtwerte der Sorte; die massgeblichen Werte
// je Ernte stehen an der Charge (Freigabe/Labor).
export const prerender = false;

const TYPEN = ['Indica', 'Sativa', 'Hybrid'];

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const name = String(daten.get('name') ?? '').trim();
  const typ = String(daten.get('typ') ?? '').trim();
  const thc = Number(String(daten.get('thc_prozent') ?? '').trim().replace(',', '.'));
  const cbd = Number(String(daten.get('cbd_prozent') ?? '').trim().replace(',', '.'));
  const notiz = String(daten.get('notiz') ?? '').trim();

  if (!name) return redirect('/mitglieder/wawi?fehler=fehlend', 303);

  // Doppelte Sorte freundlich abfangen.
  try {
    await pb.collection('sorten').getFirstListItem(`name="${name.replaceAll('"', '')}"`);
    return redirect('/mitglieder/wawi?fehler=sorte_existiert', 303);
  } catch {
    /* gut - noch nicht vorhanden */
  }

  let neu;
  try {
    neu = await pb.collection('sorten').create({
      name,
      typ: TYPEN.includes(typ) ? typ : 'Hybrid',
      thc_prozent: Number.isFinite(thc) && thc >= 0 ? thc : null,
      cbd_prozent: Number.isFinite(cbd) && cbd >= 0 ? cbd : null,
      aktiv: true,
      notiz,
    });
  } catch {
    return redirect('/mitglieder/wawi?fehler=fehlgeschlagen', 303);
  }

  await protokolliere(pb, mitglied, 'sorte.angelegt', {
    objektTyp: 'sorte', objektId: neu.id, objektLabel: name,
    details: `${TYPEN.includes(typ) ? typ : 'Hybrid'}`,
  });

  return redirect('/mitglieder/wawi?ok=sorte', 303);
};

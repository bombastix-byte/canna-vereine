import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAusgeben } from '../../../lib/rollen';

// Speichert die aktuelle Abgabe. Ein aktiver Eintrag: vorhandenen
// aktualisieren, sonst neu anlegen. Nur Ausgabe/Vorstand.
export const prerender = false;

const MAX_SORTEN = 20;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAusgeben(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const titel = String(daten.get('titel') ?? '').trim() || 'Aktuelle Abgabe diese Woche';
  const inhalt = String(daten.get('inhalt') ?? '').trim();
  const vonRaw = String(daten.get('gueltig_von') ?? '').trim();
  const bisRaw = String(daten.get('gueltig_bis') ?? '').trim();

  const sorten: Array<{ name: string; typ: string; thc: string; cbd: string }> = [];
  for (let i = 1; i <= MAX_SORTEN; i++) {
    const name = String(daten.get(`name_${i}`) ?? '').trim();
    if (!name) continue;
    sorten.push({
      name,
      typ: String(daten.get(`typ_${i}`) ?? '').trim(),
      thc: String(daten.get(`thc_${i}`) ?? '').trim(),
      cbd: String(daten.get(`cbd_${i}`) ?? '').trim(),
    });
  }

  if (titel.length < 4 || /^test\d*$/i.test(titel)) {
    return redirect('/mitglieder/wochenangebot/bearbeiten?fehler=titel', 303);
  }
  if (sorten.length === 0) {
    return redirect('/mitglieder/wochenangebot/bearbeiten?fehler=sorten', 303);
  }
  if (vonRaw && bisRaw && bisRaw < vonRaw) {
    return redirect('/mitglieder/wochenangebot/bearbeiten?fehler=zeitraum', 303);
  }

  const feld = {
    titel,
    inhalt,
    sorten,
    gueltig_von: vonRaw ? `${vonRaw} 00:00:00.000Z` : null,
    gueltig_bis: bisRaw ? `${bisRaw} 00:00:00.000Z` : null,
  };

  try {
    let vorhanden;
    try {
      vorhanden = await pb.collection('wochenangebot').getFirstListItem('', { sort: '-gueltig_von' });
    } catch {
      vorhanden = null;
    }
    if (vorhanden) {
      await pb.collection('wochenangebot').update(vorhanden.id, feld);
    } else {
      await pb.collection('wochenangebot').create(feld);
    }
  } catch {
    return redirect('/mitglieder/wochenangebot/bearbeiten?fehler=1', 303);
  }

  return redirect('/mitglieder/wochenangebot?ok=1', 303);
};

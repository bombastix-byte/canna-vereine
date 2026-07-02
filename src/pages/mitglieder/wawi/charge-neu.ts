import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';
import { chargeNr } from '../../../lib/wawi';
import { berlinTag } from '../../../lib/ausgabe';

// Legt eine neue Charge (Anbaulos) an. Nur Anbauverantwortliche/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const sorteId = String(daten.get('sorte') ?? '').trim();
  const herkunft = String(daten.get('herkunft') ?? '').trim();
  const pflanzenzahl = Number(String(daten.get('pflanzenzahl') ?? '').trim());
  const anbauStart = String(daten.get('anbau_start') ?? '').trim();
  const standort = String(daten.get('standort') ?? '').trim();

  if (!sorteId) return redirect('/mitglieder/wawi?fehler=fehlend', 303);

  try {
    const sorte = await pb.collection('sorten').getOne(sorteId);
    const jahr = berlinTag().slice(0, 4);
    const anzahl = (await pb.collection('chargen').getList(1, 1, { filter: `charge_nr~"${jahr}-"` })).totalItems;
    await pb.collection('chargen').create({
      charge_nr: chargeNr(jahr, anzahl),
      sorte: sorteId,
      sorte_name: sorte.name,
      status: 'anbau',
      herkunft,
      pflanzenzahl: Number.isFinite(pflanzenzahl) ? pflanzenzahl : null,
      anbau_start: anbauStart ? `${anbauStart} 00:00:00.000Z` : null,
      standort,
      notiz: '',
    });
  } catch {
    return redirect('/mitglieder/wawi?fehler=fehlgeschlagen', 303);
  }

  return redirect('/mitglieder/wawi?ok=angelegt', 303);
};

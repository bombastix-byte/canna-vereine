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
  const plan = String(daten.get('plan') ?? '').trim();

  if (!sorteId) return redirect('/mitglieder/wawi?fehler=fehlend', 303);

  try {
    const sorte = await pb.collection('sorten').getOne(sorteId);
    const jahr = berlinTag().slice(0, 4);
    const anzahl = (await pb.collection('chargen').getList(1, 1, { filter: `charge_nr~"${jahr}-"` })).totalItems;
    const nr = chargeNr(jahr, anzahl);
    const neu = await pb.collection('chargen').create({
      charge_nr: nr,
      sorte: sorteId,
      sorte_name: sorte.name,
      status: 'anbau',
      herkunft,
      pflanzenzahl: Number.isFinite(pflanzenzahl) ? pflanzenzahl : null,
      anbau_start: anbauStart ? `${anbauStart} 00:00:00.000Z` : null,
      standort,
      plan: plan || null,
      notiz: '',
    });
    // Pflanzen-Ebene: je Pflanze ein eigener Datensatz (P01, P02, ...).
    const n = Number.isFinite(pflanzenzahl) ? Math.min(Math.max(0, Math.trunc(pflanzenzahl)), 500) : 0;
    for (let i = 1; i <= n; i++) {
      await pb.collection('pflanzen').create({
        charge_ref: neu.id,
        nummer: `${nr}-P${String(i).padStart(2, '0')}`,
        status: 'wachsend',
      });
    }
  } catch {
    return redirect('/mitglieder/wawi?fehler=fehlgeschlagen', 303);
  }

  return redirect('/mitglieder/wawi?ok=angelegt', 303);
};

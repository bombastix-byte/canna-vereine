import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten, ROLLEN } from '../../../lib/rollen';

// Speichert Rollen/Stammdaten eines Mitglieds. Nur Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const id = String(daten.get('mitglied') ?? '').trim();
  const mitgliedsnummer = String(daten.get('mitgliedsnummer') ?? '').trim();
  const geburtsdatum = String(daten.get('geburtsdatum') ?? '').trim();
  const beitragBis = String(daten.get('beitrag_bis') ?? '').trim();
  const beitragMonatlich = Number(String(daten.get('beitrag_monatlich') ?? '').trim().replace(',', '.'));
  const iban = String(daten.get('iban') ?? '').replace(/\s+/g, '').toUpperCase();
  const bic = String(daten.get('bic') ?? '').trim().toUpperCase();
  const mandatsref = String(daten.get('mandatsref') ?? '').trim();
  const mandatsdatum = String(daten.get('mandatsdatum') ?? '').trim();
  const rollen = daten
    .getAll('rollen')
    .map((r) => String(r))
    .filter((r) => (ROLLEN as string[]).includes(r));

  if (!id) return redirect('/mitglieder/verwaltung?fehler=fehlend', 303);

  try {
    await pb.collection('users').update(id, {
      mitgliedsnummer,
      geburtsdatum: geburtsdatum ? `${geburtsdatum} 00:00:00.000Z` : null,
      beitrag_bis: beitragBis ? `${beitragBis} 00:00:00.000Z` : null,
      beitrag_monatlich: Number.isFinite(beitragMonatlich) && beitragMonatlich > 0 ? beitragMonatlich : null,
      iban,
      bic,
      mandatsref,
      mandatsdatum: mandatsdatum ? `${mandatsdatum} 00:00:00.000Z` : null,
      rollen: rollen.length ? rollen : ['mitglied'],
    });
  } catch {
    return redirect(`/mitglieder/verwaltung?fehler=fehlgeschlagen#m-${id}`, 303);
  }

  return redirect(`/mitglieder/verwaltung?ok=1#m-${id}`, 303);
};

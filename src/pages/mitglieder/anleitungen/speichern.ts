import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten } from '../../../lib/rollen';

// Legt eine Anleitung an oder aktualisiert sie (Pflege-Oberflaeche).
// Nur Vorstand; die PocketBase-Regeln erzwingen das zusaetzlich serverseitig.
export const prerender = false;

const KATEGORIEN = ['anbau', 'ernte', 'lager', 'ausgabe', 'allgemein'];
const ROLLEN_WERTE = ['', 'anbau', 'ausgabe', 'vorstand'];

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const id = String(daten.get('id') ?? '').trim();
  const titel = String(daten.get('titel') ?? '').trim();
  const kategorie = String(daten.get('kategorie') ?? '').trim();
  const zweck = String(daten.get('zweck') ?? '').trim();
  const schritte = String(daten.get('schritte') ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n');
  const hinweise = String(daten.get('hinweise') ?? '').trim();
  const rolle = String(daten.get('benoetigte_rolle') ?? '').trim();
  const aktiv = daten.get('aktiv') != null;

  const zurueckPfad = id ? `/mitglieder/anleitungen/pflege?id=${id}` : '/mitglieder/anleitungen/pflege';
  if (!titel || !schritte) return redirect(`${zurueckPfad}&fehler=fehlend`.replace('?&', '?'), 303);

  const werte = {
    titel,
    kategorie: KATEGORIEN.includes(kategorie) ? kategorie : 'allgemein',
    zweck,
    schritte,
    hinweise,
    benoetigte_rolle: ROLLEN_WERTE.includes(rolle) ? rolle || null : null,
    aktiv,
  };

  let gespeichert;
  try {
    gespeichert = id
      ? await pb.collection('anleitungen').update(id, werte)
      : await pb.collection('anleitungen').create(werte);
  } catch {
    return redirect(`${zurueckPfad}${id ? '&' : '?'}fehler=fehlgeschlagen`, 303);
  }

  return redirect(`/mitglieder/anleitungen?a=${gespeichert.id}#a-${gespeichert.id}`, 303);
};

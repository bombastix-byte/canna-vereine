import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../../lib/pb';
import { darfAnbau } from '../../../../lib/rollen';

// Fuegt einem Anbau-Plan einen Schritt hinzu oder loescht einen Schritt.
// Nur Anbau/Vorstand. Erledigte Quittungen (pflege_log) verweisen per
// Relation auf Schritte - geloeschte Schritte verschwinden aus der Planung,
// das Pflege-Protokoll bleibt bestehen.
export const prerender = false;

const TYPEN = ['phase', 'pflege', 'duengung', 'kontrolle'];

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const aktion = String(daten.get('aktion') ?? '').trim();
  const planId = String(daten.get('plan') ?? '').trim();
  const zurueck = (q: string) => redirect(`/mitglieder/anbau/plaene?${q}${planId ? `#p-${planId}` : ''}`, 303);

  if (aktion === 'loeschen') {
    const schrittId = String(daten.get('schritt') ?? '').trim();
    if (!schrittId) return zurueck('fehler=fehlend');
    try {
      await pb.collection('plan_schritte').delete(schrittId);
    } catch {
      return zurueck('fehler=fehlgeschlagen');
    }
    return zurueck('ok=geloescht');
  }

  if (aktion === 'neu') {
    const tagVon = Number(String(daten.get('tag_von') ?? '').trim());
    const titel = String(daten.get('titel') ?? '').trim();
    const typ = String(daten.get('typ') ?? '').trim();
    const details = String(daten.get('details') ?? '').trim();
    const wiederholungRoh = Number(String(daten.get('wiederholung_tage') ?? '').trim());
    const anleitung = String(daten.get('anleitung') ?? '').trim();

    if (!planId || !titel || !Number.isFinite(tagVon) || tagVon < 1) {
      return zurueck('fehler=fehlend');
    }
    try {
      await pb.collection('plan_schritte').create({
        plan: planId,
        tag_von: Math.trunc(tagVon),
        titel,
        typ: TYPEN.includes(typ) ? typ : 'pflege',
        details,
        wiederholung_tage: Number.isFinite(wiederholungRoh) && wiederholungRoh > 0 ? Math.trunc(wiederholungRoh) : null,
        anleitung: anleitung || null,
      });
    } catch {
      return zurueck('fehler=fehlgeschlagen');
    }
    return zurueck('ok=schritt');
  }

  return zurueck('fehler=fehlgeschlagen');
};

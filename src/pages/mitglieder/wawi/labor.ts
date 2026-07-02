import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';

// Hinterlegt Laborunterlagen an einer Charge: Zertifikat (COA) als Datei
// und/oder einen Link zu eigenen Testergebnissen (z. B. Mess-App).
// Nur Anbau/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const chargeId = String(daten.get('charge') ?? '').trim();
  const url = String(daten.get('testergebnis_url') ?? '').trim();
  const datei = daten.get('coa');
  const zurueck = (q: string) => redirect(`/mitglieder/wawi?${q}#c-${chargeId}`, 303);

  if (!chargeId) return zurueck('fehler=fehlend');
  const hatDatei = datei instanceof File && datei.size > 0;
  if (!hatDatei && !url) return zurueck('fehler=fehlend');
  if (url && !/^https?:\/\//i.test(url)) return zurueck('fehler=fehlgeschlagen');

  try {
    const fd = new FormData();
    if (hatDatei) fd.set('coa', datei);
    if (url) fd.set('testergebnis_url', url);
    await pb.collection('chargen').update(chargeId, fd);
  } catch {
    return zurueck('fehler=fehlgeschlagen');
  }

  return zurueck('ok=labor');
};

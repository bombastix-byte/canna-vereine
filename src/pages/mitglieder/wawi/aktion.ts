import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';
import { moeglicheAktionen } from '../../../lib/wawi';

// Fuehrt einen Lebenszyklus-Schritt einer Charge aus: Ernte erfassen, Freigeben
// oder Sperren. Nur Anbauverantwortliche/Vorstand.
export const prerender = false;

const zahl = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : null;
};

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const chargeId = String(daten.get('charge') ?? '').trim();
  const aktion = String(daten.get('aktion') ?? '').trim();
  const zurueck = (q) => redirect(`/mitglieder/wawi?${q}#c-${chargeId}`, 303);

  if (!chargeId || !aktion) return zurueck('fehler=fehlend');

  let charge;
  try {
    charge = await pb.collection('chargen').getOne(chargeId);
  } catch {
    return zurueck('fehler=fehlgeschlagen');
  }
  if (!moeglicheAktionen(charge.status).includes(aktion)) {
    return zurueck('fehler=status');
  }

  const patch = {};
  if (aktion === 'ernte') {
    const frisch = zahl(daten.get('frischgewicht_g'));
    const datum = String(daten.get('ernte_datum') ?? '').trim();
    if (frisch == null || frisch <= 0) return zurueck('fehler=menge');
    patch.status = 'geerntet';
    patch.frischgewicht_g = frisch;
    patch.ernte_datum = datum ? `${datum} 00:00:00.000Z` : null;
  } else if (aktion === 'freigabe') {
    const trocken = zahl(daten.get('trockengewicht_g'));
    const thc = zahl(daten.get('thc_prozent'));
    const cbd = zahl(daten.get('cbd_prozent'));
    if (trocken == null || trocken <= 0) return zurueck('fehler=menge');
    patch.status = 'freigegeben';
    patch.trockengewicht_g = trocken;
    patch.verfuegbar_g = trocken;
    if (thc != null) patch.thc_prozent = thc;
    if (cbd != null) patch.cbd_prozent = cbd;
  } else if (aktion === 'sperren') {
    patch.status = 'gesperrt';
  } else {
    return zurueck('fehler=status');
  }

  try {
    await pb.collection('chargen').update(chargeId, patch);
  } catch {
    return zurueck('fehler=fehlgeschlagen');
  }
  return zurueck('ok=' + aktion);
};

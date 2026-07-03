import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';

// Weist einer Charge einen Anbau-Plan zu (oder entfernt ihn). Nur Anbau/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const chargeId = String(daten.get('charge') ?? '').trim();
  const planId = String(daten.get('plan') ?? '').trim();
  if (!chargeId) return redirect('/mitglieder/wawi?fehler=fehlend', 303);

  try {
    await pb.collection('chargen').update(chargeId, { plan: planId || null });
  } catch {
    return redirect(`/mitglieder/wawi?fehler=fehlgeschlagen#c-${chargeId}`, 303);
  }
  return redirect(`/mitglieder/wawi?ok=plan#c-${chargeId}`, 303);
};

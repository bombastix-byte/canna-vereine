import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';
import { berlinTag } from '../../../lib/ausgabe';
import { protokolliere } from '../../../lib/audit';

// Dokumentiert eine Vernichtung (dokumentationspflichtig). Legt einen
// Vernichtungssatz an und schreibt bei freigegebener Charge den Bestand fort.
// Nur Anbauverantwortliche/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const chargeId = String(daten.get('charge') ?? '').trim();
  const menge = Number(String(daten.get('menge_gramm') ?? '').trim());
  const grund = String(daten.get('grund') ?? '').trim();
  const zeuge = String(daten.get('zeuge') ?? '').trim();
  const notiz = String(daten.get('notiz') ?? '').trim();
  const zurueck = (q) => redirect(`/mitglieder/wawi?${q}#c-${chargeId}`, 303);

  if (!chargeId) return zurueck('fehler=fehlend');
  if (!Number.isFinite(menge) || menge <= 0) return zurueck('fehler=menge');

  let charge;
  try {
    charge = await pb.collection('chargen').getOne(chargeId);
  } catch {
    return zurueck('fehler=fehlgeschlagen');
  }

  try {
    await pb.collection('vernichtungen').create({
      charge_ref: chargeId,
      charge_nr: charge.charge_nr || '',
      sorte_name: charge.sorte_name || '',
      menge_gramm: menge,
      grund,
      datum: berlinTag(),
      durchgefuehrt_von: mitglied.id,
      zeuge,
      notiz,
    });
  } catch {
    return zurueck('fehler=fehlgeschlagen');
  }

  // Bestand fortschreiben, wenn die Charge freigegeben ist.
  if (charge.status === 'freigegeben' && charge.verfuegbar_g != null) {
    try {
      const rest = Math.max(0, Number(charge.verfuegbar_g) - menge);
      const patch = { verfuegbar_g: rest };
      if (rest === 0) patch.status = 'aufgebraucht';
      await pb.collection('chargen').update(chargeId, patch);
    } catch {
      /* Vernichtungssatz bleibt gueltig; Bestand ggf. manuell korrigieren. */
    }
  }

  await protokolliere(pb, mitglied, 'vernichtung.erfasst', {
    objektTyp: 'charge', objektId: chargeId, objektLabel: charge.charge_nr || chargeId,
    details: `${menge} g${grund ? ` · ${grund}` : ''}${zeuge ? ` · Zeuge: ${zeuge}` : ''}`,
  });

  return zurueck('ok=vernichtet');
};

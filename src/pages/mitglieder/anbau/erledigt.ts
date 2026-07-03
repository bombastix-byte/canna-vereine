import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';
import { berlinTag } from '../../../lib/ausgabe';

// Quittiert einen Pflege-/Duengeschritt fuer eine Charge ("erledigt") -
// dokumentiert wer, wann und fuer welchen Zyklustag. Nur Anbau/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const chargeId = String(daten.get('charge') ?? '').trim();
  const schrittId = String(daten.get('schritt') ?? '').trim();
  const zyklustag = Number(String(daten.get('zyklustag') ?? '').trim());
  const notiz = String(daten.get('notiz') ?? '').trim();
  const zurueckZu = String(daten.get('zurueck') ?? '').trim() === 'wawi'
    ? `/mitglieder/wawi#c-${chargeId}`
    : '/mitglieder/anbau';

  if (!chargeId || !schrittId || !Number.isFinite(zyklustag) || zyklustag < 1) {
    return redirect(`${zurueckZu.split('#')[0]}?fehler=fehlend`, 303);
  }

  try {
    // Doppel-Quittung verhindern (idempotent bei Doppelklick).
    const schon = await pb.collection('pflege_log').getList(1, 1, {
      filter: `charge_ref="${chargeId}" && schritt="${schrittId}" && zyklustag=${zyklustag}`,
    });
    if (schon.totalItems === 0) {
      await pb.collection('pflege_log').create({
        charge_ref: chargeId,
        schritt: schrittId,
        zyklustag,
        datum: berlinTag(),
        person: mitglied.id,
        notiz,
      });
    }
  } catch {
    return redirect(`${zurueckZu.split('#')[0]}?fehler=fehlgeschlagen`, 303);
  }

  return redirect(zurueckZu.includes('#') ? zurueckZu : `${zurueckZu}?ok=1`, 303);
};

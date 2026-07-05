import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';
import { berlinTag } from '../../../lib/ausgabe';
import { sendePush } from '../../../lib/push';

// Chargen-Rueckruf: sperrt die Charge, markiert sie als Rueckruf und
// benachrichtigt ALLE Mitglieder, die aus dieser Charge etwas erhalten haben
// (Push an ihre Geraete). Legt eine Journal-Zeile fuer die Nachvollziehbarkeit
// an. Nur Anbau/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const chargeId = String(daten.get('charge') ?? '').trim();
  const grund = String(daten.get('grund') ?? '').trim();
  if (!chargeId) return redirect('/mitglieder/wawi', 303);
  const zurueck = (q: string) => redirect(`/mitglieder/wawi/rueckruf/${chargeId}?${q}`, 303);

  let charge;
  try {
    charge = await pb.collection('chargen').getOne(chargeId);
  } catch {
    return redirect('/mitglieder/wawi?fehler=fehlgeschlagen', 303);
  }

  const tag = berlinTag();

  // Charge sperren + als Rueckruf markieren.
  try {
    await pb.collection('chargen').update(chargeId, {
      status: 'gesperrt',
      rueckruf: true,
      rueckruf_grund: grund,
      rueckruf_am: tag,
    });
  } catch {
    return zurueck('fehler=fehlgeschlagen');
  }

  // Empfaenger ermitteln: alle nicht stornierten Abgaben dieser Charge.
  let abgaben: Array<Record<string, any>> = [];
  try {
    abgaben = await pb.collection('ausgaben').getFullList({
      filter: `charge_ref="${chargeId}" && storniert!=true`,
    });
  } catch {
    abgaben = [];
  }
  const mitgliedIds = [...new Set(abgaben.map((a) => a.mitglied).filter(Boolean))];

  // Push an die Geraete jedes betroffenen Mitglieds (best-effort).
  let benachrichtigt = 0;
  if (mitgliedIds.length) {
    let abos: Array<Record<string, any>> = [];
    try {
      const orFilter = mitgliedIds.map((id) => `mitglied="${id}"`).join(' || ');
      abos = await pb.collection('push_abos').getFullList({ filter: orFilter });
    } catch {
      abos = [];
    }
    if (abos.length) {
      const res = await sendePush(
        abos.map((a) => ({ endpoint: a.endpoint, p256dh: a.p256dh, auth: a.auth })),
        {
          titel: 'Wichtiger Hinweis zu einer Abgabe',
          text: `Die Charge ${charge.charge_nr ?? ''} wurde zurückgerufen${grund ? ` (${grund})` : ''}. Bitte nicht mehr konsumieren und im Verein melden.`,
          url: '/mitglieder/ausweis',
        },
      );
      benachrichtigt = res.gesendet;
      for (const a of abos) {
        if (res.tot.includes(a.endpoint)) {
          try {
            await pb.collection('push_abos').delete(a.id);
          } catch {
            /* egal */
          }
        }
      }
    }
  }

  // Journal-Eintrag (Nachvollziehbarkeit).
  try {
    await pb.collection('rueckrufe').create({
      charge: chargeId,
      charge_nr: charge.charge_nr ?? '',
      grund,
      datum: tag,
      empfaenger_zahl: mitgliedIds.length,
      benachrichtigt,
      von: mitglied.id,
    });
  } catch {
    /* Journal ist Zusatz - der Rueckruf selbst ist gesetzt */
  }

  return zurueck('ok=rueckruf');
};

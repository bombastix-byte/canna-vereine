import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';
import { berlinTag } from '../../../lib/ausgabe';
import { protokolliere } from '../../../lib/audit';

// Dokumentiert einen Transport (Paragraf 22 KCanG: mitzufuehrende Bescheinigung
// beim Befoerdern zwischen Anbaustaette/Ausgabestelle). Reines Begleitdokument -
// der Bestand der Charge aendert sich dadurch NICHT (Ortswechsel, kein Abgang).
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const chargeId = String(daten.get('charge') ?? '').trim();
  const menge = Number(String(daten.get('menge_gramm') ?? '').trim().replace(',', '.'));
  const von = String(daten.get('von') ?? '').trim();
  const nach = String(daten.get('nach') ?? '').trim();
  const zweck = String(daten.get('zweck') ?? '').trim();
  const zurueck = (q: string) => redirect(`/mitglieder/wawi?${q}#c-${chargeId}`, 303);

  if (!chargeId || !von || !nach) return zurueck('fehler=fehlend');
  if (!Number.isFinite(menge) || menge <= 0) return zurueck('fehler=menge');

  let charge;
  try {
    charge = await pb.collection('chargen').getOne(chargeId);
  } catch {
    return zurueck('fehler=fehlgeschlagen');
  }

  const tag = berlinTag();
  let neu;
  try {
    neu = await pb.collection('transporte').create({
      charge_ref: chargeId,
      charge_nr: charge.charge_nr || '',
      sorte_name: charge.sorte_name || '',
      menge_gramm: menge,
      von,
      nach,
      datum: tag,
      person: mitglied.id,
      person_name: mitglied.name || mitglied.email,
      zweck,
      belegnr: 'T-' + tag.replaceAll('-', '') + '-' + String(Date.now()).slice(-5),
    });
  } catch {
    return zurueck('fehler=fehlgeschlagen');
  }

  await protokolliere(pb, mitglied, 'transport.erfasst', {
    objektTyp: 'charge', objektId: chargeId, objektLabel: charge.charge_nr || chargeId,
    details: `${menge} g · ${von} → ${nach}${zweck ? ` · ${zweck}` : ''}`,
  });

  return redirect(`/mitglieder/wawi/transport/${neu.id}?neu=1`, 303);
};

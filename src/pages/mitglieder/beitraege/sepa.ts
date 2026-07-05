import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten } from '../../../lib/rollen';
import { hatBeitraege } from '../../../lib/funktionen';
import { buildPain008, sepaGlaeubigerAusEnv, normIban, type SeqTyp } from '../../../lib/sepa';

// Erzeugt die SEPA-Lastschriftdatei (pain.008) fuer alle Mitglieder mit
// vollstaendigem Mandat und positivem Monatsbeitrag. Nur Vorstand.
export const prerender = false;

const SEQ: SeqTyp[] = ['FRST', 'RCUR', 'OOFF', 'FNAL'];
const iso = /^\d{4}-\d{2}-\d{2}$/;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);
  if (!hatBeitraege) return redirect('/mitglieder/bereich', 303);

  const glaeubiger = sepaGlaeubigerAusEnv();
  if (!glaeubiger) return redirect('/mitglieder/beitraege?fehler=glaeubiger', 303);

  const daten = await request.formData();
  const ausfuehrungsdatum = String(daten.get('ausfuehrungsdatum') ?? '').trim();
  const seqTyp = String(daten.get('seq_typ') ?? 'RCUR').trim() as SeqTyp;
  const verwendungszweck = String(daten.get('verwendungszweck') ?? 'Mitgliedsbeitrag').trim();
  if (!iso.test(ausfuehrungsdatum) || !SEQ.includes(seqTyp)) {
    return redirect('/mitglieder/beitraege?fehler=eingabe', 303);
  }

  let users: Array<Record<string, any>> = [];
  try {
    users = await pb.collection('users').getFullList({ sort: 'mitgliedsnummer' });
  } catch {
    users = [];
  }

  const mandate = users
    .filter((u) => u.iban && u.mandatsref && u.mandatsdatum && Number(u.beitrag_monatlich) > 0)
    .map((u) => ({
      name: u.name || u.email,
      iban: normIban(u.iban),
      bic: u.bic || undefined,
      mandatsref: String(u.mandatsref),
      mandatsdatum: String(u.mandatsdatum).slice(0, 10),
      betragCent: Math.round(Number(u.beitrag_monatlich) * 100),
      endToEnd: `${u.mitgliedsnummer || u.id}-${ausfuehrungsdatum.slice(0, 7)}`,
    }));

  if (mandate.length === 0) return redirect('/mitglieder/beitraege?fehler=leer', 303);

  const jetzt = new Date();
  const stamp = jetzt.toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  let ergebnis2;
  try {
    ergebnis2 = buildPain008({
      msgId: `SEPA-${stamp}`,
      creDtTm: jetzt.toISOString().slice(0, 19),
      glaeubiger,
      seqTyp,
      ausfuehrungsdatum,
      verwendungszweck,
      mandate,
    });
  } catch {
    return redirect('/mitglieder/beitraege?fehler=leer', 303);
  }

  return new Response(ergebnis2.xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'content-disposition': `attachment; filename="sepa-beitraege-${ausfuehrungsdatum}.xml"`,
    },
  });
};

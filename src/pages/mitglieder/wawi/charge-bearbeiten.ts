import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';
import { protokolliere, feldDiff } from '../../../lib/audit';

// Charge-Stammdaten bearbeiten. Rechtlich sensible Felder (Charge-Nr., THC/CBD,
// verfügbarer Bestand) sind bei einer bereits GENUTZTEN Charge (freigegeben/
// aufgebraucht/gesperrt oder mit Abgaben) nur mit Pflicht-Grund änderbar. Jede
// Änderung landet mit Vorher/Nachher im Protokoll. Nur Anbau/Vorstand.
export const prerender = false;

const SENSIBEL = [
  { key: 'charge_nr', label: 'Charge-Nr.' },
  { key: 'thc_prozent', label: 'THC %' },
  { key: 'cbd_prozent', label: 'CBD %' },
  { key: 'verfuegbar_g', label: 'verfügbarer Bestand' },
];
const NORMAL = [
  { key: 'sorte_name', label: 'Sorte' },
  { key: 'herkunft', label: 'Herkunft' },
  { key: 'standort', label: 'Standort' },
  { key: 'notiz', label: 'Notiz' },
];

const zahlOderNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const id = String(daten.get('charge') ?? '').trim();
  const grund = String(daten.get('grund') ?? '').trim();
  if (!id) return redirect('/mitglieder/wawi', 303);
  const zurueck = (q: string) => redirect(`/mitglieder/wawi/charge/${id}?${q}`, 303);

  let alt: Record<string, any>;
  try {
    alt = await pb.collection('chargen').getOne(id);
  } catch {
    return redirect('/mitglieder/wawi?fehler=fehlgeschlagen', 303);
  }

  const neu: Record<string, any> = {
    charge_nr: String(daten.get('charge_nr') ?? '').trim(),
    sorte_name: String(daten.get('sorte_name') ?? '').trim(),
    herkunft: String(daten.get('herkunft') ?? '').trim(),
    standort: String(daten.get('standort') ?? '').trim(),
    notiz: String(daten.get('notiz') ?? '').trim(),
    thc_prozent: zahlOderNull(daten.get('thc_prozent')),
    cbd_prozent: zahlOderNull(daten.get('cbd_prozent')),
    verfuegbar_g: zahlOderNull(daten.get('verfuegbar_g')),
  };

  // Ist die Charge in Benutzung? -> dann sind sensible Änderungen begründungspflichtig.
  let abgaben = 0;
  try {
    abgaben = (await pb.collection('ausgaben').getList(1, 1, { filter: `charge_ref="${id}"` })).totalItems;
  } catch {
    abgaben = 0;
  }
  const inBenutzung = abgaben > 0 || ['freigegeben', 'aufgebraucht', 'gesperrt'].includes(String(alt.status));

  const sensibelGeaendert = SENSIBEL.filter((f) => String(alt[f.key] ?? '') !== String(neu[f.key] ?? ''));
  if (inBenutzung && sensibelGeaendert.length > 0 && !grund) {
    return zurueck('fehler=grund');
  }

  try {
    await pb.collection('chargen').update(id, neu);
  } catch {
    return zurueck('fehler=fehlgeschlagen');
  }

  const diff = feldDiff(alt, neu, [...SENSIBEL, ...NORMAL]);
  if (diff) {
    await protokolliere(pb, mitglied, 'charge.bearbeitet', {
      objektTyp: 'charge', objektId: id, objektLabel: neu.charge_nr || alt.charge_nr || id,
      details: diff + (sensibelGeaendert.length && grund ? ` · Grund: ${grund}` : ''),
    });
  }
  return zurueck('ok=1');
};

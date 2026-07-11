import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAusgeben } from '../../../lib/rollen';
import { berlinTag } from '../../../lib/ausgabe';
import { protokolliere } from '../../../lib/audit';
import { inReihe } from '../../../lib/serie';

// Storniert einen kompletten Abgabe-Vorgang (Beleg): alle Positionen werden als
// storniert markiert (append-only, bleiben erhalten) und der Chargenbestand
// wird zurueckgebucht. Stornierte Abgaben zaehlen nicht mehr in Limits, Kasse
// und Jahresmeldung. Nur Ausgabe/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAusgeben(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const belegId = String(daten.get('beleg') ?? '').trim();
  const grund = String(daten.get('grund') ?? '').trim();
  if (!belegId) return redirect('/mitglieder/ausgabe', 303);

  let anker;
  try {
    anker = await pb.collection('ausgaben').getOne(belegId);
  } catch {
    return redirect('/mitglieder/ausgabe', 303);
  }

  // Alle Positionen dieses Vorgangs (gleiche Belegnr + Mitglied), noch nicht storniert.
  let positionen: Array<Record<string, any>> = [anker];
  if (anker.belegnr) {
    try {
      positionen = await pb.collection('ausgaben').getFullList({
        filter: `belegnr="${anker.belegnr}" && mitglied="${anker.mitglied}"`,
      });
    } catch {
      positionen = [anker];
    }
  }
  positionen = positionen.filter((p) => p.storniert !== true);
  if (positionen.length === 0) {
    return redirect(`/mitglieder/ausgabe/beleg/${belegId}?fehler=schon`, 303);
  }

  const tag = berlinTag();
  for (const p of positionen) {
    try {
      await pb.collection('ausgaben').update(p.id, {
        storniert: true,
        storniert_am: tag,
        storniert_von: mitglied.id,
        storno_grund: grund,
      });
    } catch {
      /* naechste Position trotzdem versuchen */
    }
    // Bestand zurueckbuchen per PB-Feld-Modifier "verfuegbar_g+" (T4, fixt
    // F4-Szenario B) statt Lesen-Addieren-Schreiben, zusaetzlich per Charge
    // serialisiert (inReihe) - der Modifier allein ist bei echt gleich-
    // zeitigen Requests auf denselben Datensatz nicht verlustfrei (siehe
    // Kommentar in buchen.ts). Die Status-Reaktivierung (aufgebraucht ->
    // freigegeben) richtet sich nach dem vom Update zurueckgegebenen
    // (also aktuellen) Datensatz.
    if (p.charge_ref) {
      try {
        const aktualisiert = await inReihe(`charge:${p.charge_ref}`, () =>
          pb.collection('chargen').update(p.charge_ref, { 'verfuegbar_g+': Number(p.menge_gramm) || 0 }),
        );
        if (aktualisiert.status === 'aufgebraucht' && Number(aktualisiert.verfuegbar_g) > 0) {
          await pb.collection('chargen').update(p.charge_ref, { status: 'freigegeben' });
        }
      } catch {
        /* Bestand ggf. von Hand korrigieren */
      }
    }
  }

  const summe = positionen.reduce((s, p) => s + (Number(p.menge_gramm) || 0), 0);
  await protokolliere(pb, mitglied, 'abgabe.storniert', {
    objektTyp: 'beleg', objektId: belegId, objektLabel: anker.belegnr ?? belegId,
    details: `${positionen.length} Position(en), ${summe} g${grund ? ` · Grund: ${grund}` : ''}`,
  });

  return redirect(`/mitglieder/ausgabe/beleg/${belegId}?ok=storniert`, 303);
};

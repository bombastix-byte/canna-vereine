import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten } from '../../../lib/rollen';
import { MODUL_KEYS } from '../../../lib/einstellungen';
import { protokolliere } from '../../../lib/audit';
import { berlinTag } from '../../../lib/ausgabe';

// Speichert die Modul-Auswahl in der einstellungen-Collection (ein Datensatz).
// Alle Schlüssel werden ausdrücklich gesetzt, damit die DB die Config-Defaults
// vollständig überschreibt. Nur Vorstand. Auditiert.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const funktionen: Record<string, boolean> = {};
  const an: string[] = [];
  for (const k of MODUL_KEYS) {
    const wert = daten.get(k) === 'on' || daten.get(k) === '1';
    funktionen[k] = wert;
    if (wert) an.push(k);
  }
  const abRaw = String(daten.get('aufnahmebeitrag_euro') ?? '').trim().replace(',', '.');
  const ab = abRaw === '' ? null : Math.max(0, Number(abRaw) || 0);

  try {
    let row;
    try {
      row = await pb.collection('einstellungen').getFirstListItem('');
    } catch {
      row = null;
    }
    const patch = {
      funktionen,
      aufnahmebeitrag_euro: ab,
      aktualisiert_am: berlinTag(),
      aktualisiert_von: mitglied.name || mitglied.mitgliedsnummer || mitglied.id,
    };
    if (row) {
      await pb.collection('einstellungen').update(row.id, patch);
    } else {
      await pb.collection('einstellungen').create(patch);
    }
  } catch {
    return redirect('/mitglieder/verwaltung/module?fehler=1', 303);
  }

  await protokolliere(pb, mitglied, 'module.geaendert', {
    objektTyp: 'system', objektId: 'funktionen',
    details: `aktiv: ${an.join(', ') || '—'}${ab != null ? ` · Aufnahmebeitrag ${ab.toFixed(2)} €` : ''}`,
  });

  return redirect('/mitglieder/verwaltung/module?ok=1', 303);
};

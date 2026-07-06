import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { berlinTag } from '../../../lib/ausgabe';
import { protokolliere } from '../../../lib/audit';

// Mitglieds-Selbstverwaltung: das angemeldete Mitglied ändert AUSSCHLIESSLICH
// eigene Kontakt-/SEPA-Daten. Es werden bewusst nur diese Felder geschrieben;
// die users-updateRule blockiert zusätzlich alles andere (Rollen, Beiträge,
// Identität) als zweite Sicherung.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const __fn = locals.funktionen;
  const hatBeitraege = __fn ? __fn.beitraege !== false : true;
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;

  const daten = await request.formData();
  const telefon = String(daten.get('telefon') ?? '').trim();
  const iban = String(daten.get('iban') ?? '').replace(/\s+/g, '').toUpperCase();
  const bic = String(daten.get('bic') ?? '').trim().toUpperCase();
  const mandat = daten.get('mandat') === 'on' || daten.get('mandat') === '1';

  // Vorzustand laden (für Mandats-Logik + Diff).
  let alt: Record<string, any> = {};
  try {
    alt = await pb.collection('users').getOne(mitglied.id);
  } catch {
    alt = {};
  }

  // Ohne Beitrags-Modul pflegt das Mitglied nur die Kontaktdaten (kein SEPA).
  const patch: Record<string, unknown> = hatBeitraege ? { telefon, iban, bic } : { telefon };

  // SEPA-Mandat: Erteilt das Mitglied (oder ändert die IBAN), setzen wir
  // Mandatsreferenz (einmalig) und -datum. Ohne IBAN kein Mandat.
  if (hatBeitraege && mandat && iban) {
    const ibanGeaendert = (alt.iban ?? '') !== iban;
    if (!alt.mandatsref || ibanGeaendert) {
      const ref = `${mitglied.mitgliedsnummer || mitglied.id}-${berlinTag().replace(/-/g, '')}`;
      patch.mandatsref = ref;
      patch.mandatsdatum = `${berlinTag()} 00:00:00.000Z`;
    }
  } else if (hatBeitraege && !mandat) {
    // Mandat zurückgezogen: Referenz/Datum entfernen (IBAN bleibt als Kontakt).
    patch.mandatsref = '';
    patch.mandatsdatum = null;
  }

  try {
    await pb.collection('users').update(mitglied.id, patch);
  } catch {
    return redirect('/mitglieder/profil?fehler=fehlgeschlagen', 303);
  }

  // Protokoll (Selbständerung transparent im Audit-Log).
  const teile: string[] = [];
  if ((alt.telefon ?? '') !== telefon) teile.push('Telefon');
  if ((alt.iban ?? '') !== iban) teile.push('IBAN');
  if ((alt.bic ?? '') !== bic) teile.push('BIC');
  if (patch.mandatsref !== undefined && patch.mandatsref !== (alt.mandatsref ?? '')) teile.push('SEPA-Mandat');
  if (teile.length) {
    await protokolliere(pb, mitglied, 'mitglied.aktualisiert', {
      objektTyp: 'mitglied', objektId: mitglied.id,
      objektLabel: `${mitglied.mitgliedsnummer || ''} ${mitglied.name || ''}`.trim(),
      details: `Selbstverwaltung · geändert: ${teile.join(', ')}`,
    });
  }

  return redirect('/mitglieder/profil?ok=1', 303);
};

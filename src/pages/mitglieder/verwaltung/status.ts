import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten } from '../../../lib/rollen';
import { MITGLIED_STATUS, STATUS_LABEL } from '../../../lib/status';
import { protokolliere } from '../../../lib/audit';

// Setzt den Mitglieds-Lebenszyklus-Status (aktiv/ruhend/gekündigt/ausgetreten)
// samt optionalem Austrittsdatum und Notiz. Nur Vorstand. Ersetzt das
// Hart-Löschen als schonenden Weg (Historie bleibt erhalten).
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const id = String(daten.get('mitglied') ?? '').trim();
  const status = String(daten.get('mitglied_status') ?? '').trim();
  const austritt = String(daten.get('austritt_zum') ?? '').trim();
  const notiz = String(daten.get('status_notiz') ?? '').trim();
  if (!id || !(MITGLIED_STATUS as readonly string[]).includes(status)) {
    return redirect(`/mitglieder/verwaltung/${id}?fehler=status`, 303);
  }

  let alt: Record<string, any> = {};
  try {
    alt = await pb.collection('users').getOne(id);
  } catch {
    return redirect('/mitglieder/verwaltung?fehler=nichtgefunden', 303);
  }

  try {
    await pb.collection('users').update(id, {
      mitglied_status: status,
      // Austrittsdatum nur bei „gekündigt" sinnvoll; sonst leeren.
      austritt_zum: status === 'gekuendigt' && austritt ? `${austritt} 00:00:00.000Z` : null,
      status_notiz: notiz,
    });
  } catch {
    return redirect(`/mitglieder/verwaltung/${id}?fehler=fehlgeschlagen`, 303);
  }

  if ((alt.mitglied_status || 'aktiv') !== status) {
    const label = `${alt.mitgliedsnummer || ''} ${[alt.vorname, alt.nachname].filter(Boolean).join(' ') || alt.name || ''}`.trim();
    await protokolliere(pb, mitglied, 'mitglied.status', {
      objektTyp: 'mitglied', objektId: id, objektLabel: label,
      details: `${STATUS_LABEL[alt.mitglied_status || 'aktiv']} → ${STATUS_LABEL[status]}${status === 'gekuendigt' && austritt ? ` (zum ${austritt})` : ''}`,
    });
  }

  return redirect(`/mitglieder/verwaltung/${id}?ok=status`, 303);
};

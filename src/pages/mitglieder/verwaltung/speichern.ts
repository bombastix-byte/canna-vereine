import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten, ROLLEN } from '../../../lib/rollen';
import { protokolliere, feldDiff } from '../../../lib/audit';
import { hatBeitraege } from '../../../lib/funktionen';

// Speichert Rollen/Stammdaten eines Mitglieds. Nur Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const id = String(daten.get('mitglied') ?? '').trim();
  const vorname = String(daten.get('vorname') ?? '').trim();
  const nachname = String(daten.get('nachname') ?? '').trim();
  const mitgliedsnummer = String(daten.get('mitgliedsnummer') ?? '').trim();
  const geburtsdatum = String(daten.get('geburtsdatum') ?? '').trim();
  const beitragBis = String(daten.get('beitrag_bis') ?? '').trim();
  const beitragMonatlich = Number(String(daten.get('beitrag_monatlich') ?? '').trim().replace(',', '.'));
  const iban = String(daten.get('iban') ?? '').replace(/\s+/g, '').toUpperCase();
  const bic = String(daten.get('bic') ?? '').trim().toUpperCase();
  const mandatsref = String(daten.get('mandatsref') ?? '').trim();
  const mandatsdatum = String(daten.get('mandatsdatum') ?? '').trim();
  const rollen = daten
    .getAll('rollen')
    .map((r) => String(r))
    .filter((r) => (ROLLEN as string[]).includes(r));

  if (!id) return redirect('/mitglieder/verwaltung?fehler=fehlend', 303);

  // Vorzustand für das Protokoll laden (best-effort).
  let alt: Record<string, any> | null = null;
  try {
    alt = await pb.collection('users').getOne(id);
  } catch {
    alt = null;
  }

  const neueRollen = rollen.length ? rollen : ['mitglied'];
  const neu: Record<string, unknown> = {
    vorname,
    nachname,
    mitgliedsnummer,
    geburtsdatum: geburtsdatum ? `${geburtsdatum} 00:00:00.000Z` : null,
    rollen: neueRollen,
  };
  // Beitrags-/SEPA-Felder nur pflegen, wenn das Modul aktiv ist (sonst würden
  // die nicht angezeigten Felder bestehende Werte leeren).
  if (hatBeitraege) {
    neu.beitrag_bis = beitragBis ? `${beitragBis} 00:00:00.000Z` : null;
    neu.beitrag_monatlich = Number.isFinite(beitragMonatlich) && beitragMonatlich > 0 ? beitragMonatlich : null;
    neu.iban = iban;
    neu.bic = bic;
    neu.mandatsref = mandatsref;
    neu.mandatsdatum = mandatsdatum ? `${mandatsdatum} 00:00:00.000Z` : null;
  }

  try {
    await pb.collection('users').update(id, neu);
  } catch {
    return redirect(`/mitglieder/verwaltung/${id}?fehler=fehlgeschlagen`, 303);
  }

  // Protokoll: Stammdaten-Änderung und – getrennt und deutlich – Rollenwechsel.
  const label = `${mitgliedsnummer || ''} ${vorname} ${nachname}`.trim();
  if (alt) {
    const rollenAlt = [...(alt.rollen ?? [])].sort().join(',');
    const rollenNeu = [...neueRollen].sort().join(',');
    if (rollenAlt !== rollenNeu) {
      await protokolliere(pb, mitglied, 'rolle.geaendert', {
        objektTyp: 'mitglied', objektId: id, objektLabel: label,
        details: `${rollenAlt || '—'} → ${rollenNeu || '—'}`,
      });
    }
    const diff = feldDiff(alt, neu, [
      { key: 'vorname', label: 'Vorname' }, { key: 'nachname', label: 'Nachname' },
      { key: 'mitgliedsnummer', label: 'Mitgliedsnummer' }, { key: 'geburtsdatum', label: 'Geburtsdatum' },
      { key: 'beitrag_bis', label: 'Beitrag bis' }, { key: 'beitrag_monatlich', label: 'Monatsbeitrag' },
      { key: 'iban', label: 'IBAN' }, { key: 'bic', label: 'BIC' },
      { key: 'mandatsref', label: 'Mandatsref.' }, { key: 'mandatsdatum', label: 'Mandatsdatum' },
    ]);
    if (diff) {
      await protokolliere(pb, mitglied, 'mitglied.aktualisiert', {
        objektTyp: 'mitglied', objektId: id, objektLabel: label, details: diff,
      });
    }
  }

  return redirect(`/mitglieder/verwaltung/${id}?ok=1`, 303);
};

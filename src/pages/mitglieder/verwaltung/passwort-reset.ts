import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten } from '../../../lib/rollen';
import { protokolliere } from '../../../lib/audit';

// Vorstand setzt das Passwort eines Mitglieds zurück (neues Startpasswort). Nutzt
// die manageRule der users-Collection — kein Alt-Passwort nötig. Das neue
// Passwort wird der Detailseite einmalig zum Weitergeben zurückgegeben.
export const prerender = false;

function startpasswort(): string {
  const teil = () => Math.random().toString(36).slice(2, 6);
  return `Start-${teil()}-${teil()}`;
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const id = String(daten.get('mitglied') ?? '').trim();
  if (!id) return redirect('/mitglieder/verwaltung', 303);
  // Eigenes Passwort ändert man über „Mein Konto", nicht hier.
  if (id === mitglied.id) return redirect(`/mitglieder/verwaltung/${id}?fehler=selbst`, 303);

  const pw = startpasswort();
  let ziel;
  try {
    ziel = await pb.collection('users').getOne(id);
    await pb.collection('users').update(id, { password: pw, passwordConfirm: pw });
  } catch {
    return redirect(`/mitglieder/verwaltung/${id}?fehler=pwreset`, 303);
  }

  await protokolliere(pb, mitglied, 'passwort.reset', {
    objektTyp: 'mitglied', objektId: id,
    objektLabel: `${ziel.mitgliedsnummer ?? ''} ${ziel.name ?? ''}`.trim() || id,
  });

  return redirect(`/mitglieder/verwaltung/${id}?pwreset=${encodeURIComponent(pw)}`, 303);
};

import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten } from '../../../lib/rollen';
import { sendeMail } from '../../../lib/mail';
import { mailAufnahme, mailAblehnung } from '../../../lib/mail-vorlagen';
import { site } from '../../../config';
import { protokolliere } from '../../../lib/audit';
import { bucheAufnahmebeitrag } from '../../../lib/kasse-buchung';
import { hatAufnahmebeitrag, aufnahmebeitragEuro } from '../../../lib/funktionen';

const vereinKopf = { vereinsname: site.vereinsname, email: site.kontakt.email, ort: site.kontakt.ort };

// Bearbeitet einen Beitrittsantrag: Warteliste, ablehnen oder aufnehmen.
// "Aufnehmen" legt das Mitgliedskonto an (naechste freie M-Nummer,
// Startpasswort) und markiert den Antrag. Nur Vorstand.
export const prerender = false;

function startpasswort(): string {
  // Gut lesbares Startpasswort; wird beim ersten Login geaendert.
  const teil = () => Math.random().toString(36).slice(2, 6);
  return `Start-${teil()}-${teil()}`;
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const antragId = String(daten.get('antrag') ?? '').trim();
  const aktion = String(daten.get('aktion') ?? '').trim();
  if (!antragId || !aktion) return redirect('/mitglieder/antraege?fehler=1', 303);

  let antrag;
  try {
    antrag = await pb.collection('antraege').getOne(antragId);
  } catch {
    return redirect('/mitglieder/antraege?fehler=1', 303);
  }

  if (aktion === 'warteliste' || aktion === 'ablehnen') {
    const status = aktion === 'warteliste' ? 'warteliste' : 'abgelehnt';
    try {
      await pb.collection('antraege').update(antragId, { status });
    } catch {
      return redirect('/mitglieder/antraege?fehler=1', 303);
    }
    if (aktion === 'ablehnen') {
      const v = mailAblehnung(vereinKopf, antrag.name);
      await sendeMail({ an: antrag.email, betreff: v.betreff, text: v.text });
      await protokolliere(pb, mitglied, 'antrag.abgelehnt', {
        objektTyp: 'antrag', objektId: antragId, objektLabel: antrag.name ?? antrag.email ?? antragId,
      });
    }
    return redirect(`/mitglieder/antraege?ok=${status}`, 303);
  }

  if (aktion === 'aufnehmen') {
    // Doppelte Konten verhindern.
    try {
      await pb.collection('users').getFirstListItem(`email="${antrag.email}"`);
      return redirect('/mitglieder/antraege?fehler=existiert', 303);
    } catch {
      /* kein Konto vorhanden - gut */
    }

    // Naechste freie Mitgliedsnummer M-###.
    let nr = 1;
    try {
      const alle = await pb.collection('users').getFullList({ fields: 'mitgliedsnummer' });
      for (const u of alle) {
        const m = /^M-(\d+)$/.exec(String(u.mitgliedsnummer ?? ''));
        if (m) nr = Math.max(nr, Number(m[1]) + 1);
      }
    } catch {
      /* Startwert bleibt */
    }
    const mitgliedsnummer = 'M-' + String(nr).padStart(3, '0');
    const passwort = startpasswort();

    let neuerNutzer;
    try {
      // Hinweis: `verified` darf nur ein Superuser setzen - fuer den Login
      // ist es nicht noetig, daher bewusst weggelassen.
      neuerNutzer = await pb.collection('users').create({
        email: antrag.email,
        password: passwort,
        passwordConfirm: passwort,
        name: antrag.name,
        mitgliedsnummer,
        geburtsdatum: antrag.geburtsdatum ? `${antrag.geburtsdatum} 00:00:00.000Z` : null,
        rollen: ['mitglied'],
      });
      await pb.collection('antraege').update(antragId, { status: 'aufgenommen' });
    } catch {
      return redirect('/mitglieder/antraege?fehler=1', 303);
    }

    await protokolliere(pb, mitglied, 'antrag.aufgenommen', {
      objektTyp: 'mitglied', objektId: antragId, objektLabel: `${mitgliedsnummer} ${antrag.name ?? ''}`.trim(),
    });

    // Aufnahmebeitrag (falls konfiguriert und bar kassiert) in die Kasse buchen.
    if (hatAufnahmebeitrag && daten.get('aufnahme_kassiert')) {
      await bucheAufnahmebeitrag(pb, aufnahmebeitragEuro, neuerNutzer.id, mitglied.id);
    }

    // Zugangsdaten per Mail (falls SMTP konfiguriert); sonst zeigt die Seite
    // das Startpasswort zum manuellen Weitergeben.
    const v = mailAufnahme(vereinKopf, antrag.name, mitgliedsnummer, antrag.email, passwort);
    const mail = await sendeMail({ an: antrag.email, betreff: v.betreff, text: v.text });

    const q = new URLSearchParams({ ok: 'aufgenommen', nr: mitgliedsnummer, pw: passwort, mail: mail.ok ? '1' : '0' });
    return redirect(`/mitglieder/antraege?${q.toString()}`, 303);
  }

  return redirect('/mitglieder/antraege?fehler=1', 303);
};

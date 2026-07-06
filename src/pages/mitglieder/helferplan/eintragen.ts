import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';

import { darfDienst } from '../../../lib/rollen';
import { montagVon, parseTag, ymd } from '../../../lib/helfer';

// Trägt das angemeldete Mitglied in einen Helferdienst an einem konkreten Tag
// ein. mitglied wird stets serverseitig gesetzt. Prüft schon-eingetragen /
// voll / benötigte Rolle. Erste Übernahme eines Dienstes wird erkannt, damit
// der Helferplan direkt die passende Anleitung zeigt.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const __fn = locals.funktionen;
  const hatHelferplan = __fn ? __fn.helferplan !== false : true;
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) {
    return redirect('/mitglieder?fehler=anmeldung', 303);
  }
  const { pb, mitglied } = ergebnis;
  if (!hatHelferplan) return redirect('/mitglieder/bereich', 303);

  const daten = await request.formData();
  const dienst = String(daten.get('dienst') ?? '').trim();
  const tag = String(daten.get('datum') ?? '').trim();
  const tagDate = parseTag(tag);
  const wocheQ = tagDate ? `woche=${ymd(montagVon(tagDate))}&` : '';

  if (!dienst || !tagDate) {
    return redirect(`/mitglieder/helferplan?${wocheQ}fehler=fehlend`, 303);
  }

  let erstesMal = false;
  try {
    const d = await pb.collection('helferdienste').getOne(dienst);

    // Rollen-Schutz: manche Aufgaben (z. B. Bestand wiegen, Ernte) duerfen
    // nur Mitglieder mit passender Rolle uebernehmen.
    if (!darfDienst(mitglied.rollen, d.benoetigte_rolle)) {
      return redirect(`/mitglieder/helferplan?${wocheQ}fehler=rolle`, 303);
    }

    const liste = await pb.collection('helfer_eintragungen').getFullList({
      filter: `dienst="${dienst}"`,
    });
    const amTag = liste.filter((e) => String(e.datum).slice(0, 10) === tag);

    if (amTag.some((e) => e.mitglied === mitglied.id)) {
      return redirect(`/mitglieder/helferplan?${wocheQ}fehler=schon`, 303);
    }
    if (typeof d.bedarf === 'number' && amTag.length >= d.bedarf) {
      return redirect(`/mitglieder/helferplan?${wocheQ}fehler=voll`, 303);
    }

    // Uebernimmt das Mitglied diesen Dienst zum ersten Mal? Dann zeigt der
    // Helferplan direkt die Anleitung ("gleich eine Instruktion bekommen").
    erstesMal = !liste.some((e) => e.mitglied === mitglied.id);

    await pb.collection('helfer_eintragungen').create({
      mitglied: mitglied.id,
      dienst,
      datum: `${tag} 00:00:00.000Z`,
    });
  } catch {
    return redirect(`/mitglieder/helferplan?${wocheQ}fehler=fehlgeschlagen`, 303);
  }

  const erstesQ = erstesMal ? `&erstesmal=${dienst}` : '';
  return redirect(`/mitglieder/helferplan?${wocheQ}ok=1${erstesQ}`, 303);
};

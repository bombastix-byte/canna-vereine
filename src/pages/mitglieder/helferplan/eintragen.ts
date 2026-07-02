import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { montagVon, parseTag, ymd } from '../../../lib/helfer';

// Trägt das angemeldete Mitglied in einen Helferdienst an einem konkreten Tag
// ein. mitglied wird stets serverseitig gesetzt. Prüft schon-eingetragen / voll.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) {
    return redirect('/mitglieder?fehler=anmeldung', 303);
  }
  const { pb, mitglied } = ergebnis;

  const daten = await request.formData();
  const dienst = String(daten.get('dienst') ?? '').trim();
  const tag = String(daten.get('datum') ?? '').trim();
  const tagDate = parseTag(tag);
  const wocheQ = tagDate ? `woche=${ymd(montagVon(tagDate))}&` : '';

  if (!dienst || !tagDate) {
    return redirect(`/mitglieder/helferplan?${wocheQ}fehler=fehlend`, 303);
  }

  try {
    const d = await pb.collection('helferdienste').getOne(dienst);
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

    await pb.collection('helfer_eintragungen').create({
      mitglied: mitglied.id,
      dienst,
      datum: `${tag} 00:00:00.000Z`,
    });
  } catch {
    return redirect(`/mitglieder/helferplan?${wocheQ}fehler=fehlgeschlagen`, 303);
  }

  return redirect(`/mitglieder/helferplan?${wocheQ}ok=1`, 303);
};

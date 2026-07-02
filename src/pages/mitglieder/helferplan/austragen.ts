import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { montagVon, parseTag, ymd } from '../../../lib/helfer';

// Trägt das angemeldete Mitglied wieder aus einem Helferdienst an einem
// konkreten Tag aus. Löscht nur die eigene Eintragung (per deleteRule gesichert).
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
    const liste = await pb.collection('helfer_eintragungen').getFullList({
      filter: `dienst="${dienst}" && mitglied="${mitglied.id}"`,
    });
    const treffer = liste.find((e) => String(e.datum).slice(0, 10) === tag);
    if (treffer) {
      await pb.collection('helfer_eintragungen').delete(treffer.id);
    }
  } catch {
    return redirect(`/mitglieder/helferplan?${wocheQ}fehler=fehlgeschlagen`, 303);
  }

  return redirect(`/mitglieder/helferplan?${wocheQ}aus=1`, 303);
};

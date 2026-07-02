import type { APIRoute } from 'astro';
import { neuePb, AUTH_COOKIE, PENDING_COOKIE } from '../../../lib/pb';
import { totpPruefen } from '../../../lib/totp';

// Prueft den TOTP-Code (Schritt 2 der Anmeldung). Bei Erfolg wird der Token
// aus dem Zwischen-Cookie zum echten Auth-Cookie; der genutzte Zeitschritt
// wird gespeichert, damit derselbe Code nicht zweimal gilt (Replay-Schutz).
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const pending = cookies.get(PENDING_COOKIE)?.value;
  if (!pending) return redirect('/mitglieder?fehler=anmeldung', 303);

  const daten = await request.formData();
  const code = String(daten.get('code') ?? '').trim();

  const pb = neuePb();
  pb.authStore.save(pending, null);
  let userId = '';
  try {
    const { record } = await pb.collection('users').authRefresh();
    userId = record.id;
  } catch {
    cookies.delete(PENDING_COOKIE, { path: '/' });
    return redirect('/mitglieder/code?fehler=abgelaufen', 303);
  }

  let zf;
  try {
    zf = await pb.collection('zweifaktor').getFirstListItem(`user="${userId}" && aktiv=true`);
  } catch {
    // 2FA wurde zwischenzeitlich deaktiviert - Anmeldung normal abschliessen.
    zf = null;
  }

  if (zf) {
    const schritt = totpPruefen(zf.secret, code);
    if (schritt === null || (typeof zf.letzter_schritt === 'number' && schritt <= zf.letzter_schritt)) {
      return redirect('/mitglieder/code?fehler=code', 303);
    }
    try {
      await pb.collection('zweifaktor').update(zf.id, { letzter_schritt: schritt });
    } catch {
      /* Replay-Marker konnte nicht gespeichert werden - Anmeldung trotzdem ok. */
    }
  }

  cookies.delete(PENDING_COOKIE, { path: '/' });
  cookies.set(AUTH_COOKIE, pending, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return redirect('/mitglieder/bereich', 303);
};

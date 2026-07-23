import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfVerwalten } from '../../../lib/rollen';

import { berlinTag } from '../../../lib/ausgabe';
import { beitragStatus, mahnstufeName, type BeitragMitglied } from '../../../lib/beitrag';
import { sendePush } from '../../../lib/push';
import { protokolliere } from '../../../lib/audit';

// Zahlungserinnerung / Mahnung an ein Mitglied: erhoeht die Mahnstufe, merkt
// das Datum und schickt (falls Push eingerichtet) eine Benachrichtigung an die
// Geraete des Mitglieds. Nur Vorstand.
export const prerender = false;

const eur = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const __fn = locals.funktionen;
  const hatBeitraege = __fn ? __fn.beitraege !== false : true;
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfVerwalten(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);
  if (!hatBeitraege) return redirect('/mitglieder/bereich', 303);

  const daten = await request.formData();
  const mitgliedId = String(daten.get('mitglied') ?? '').trim();
  if (!mitgliedId) return redirect('/mitglieder/beitraege/status?fehler=eingabe', 303);

  let u;
  try {
    u = await pb.collection('users').getOne(mitgliedId);
  } catch {
    return redirect('/mitglieder/beitraege/status?fehler=unbekannt', 303);
  }

  const st = beitragStatus(u as unknown as BeitragMitglied, berlinTag());
  if (!st.imRueckstand) {
    return redirect('/mitglieder/beitraege/status?fehler=nichtoffen', 303);
  }

  const neueStufe = Math.min(3, (Number(u.mahnstufe) || 0) + 1);
  try {
    await pb.collection('users').update(mitgliedId, {
      mahnstufe: neueStufe,
      gemahnt_am: berlinTag(),
    });
  } catch {
    return redirect('/mitglieder/beitraege/status?fehler=fehlgeschlagen', 303);
  }

  // Push an die Geraete dieses Mitglieds (best-effort).
  try {
    const abos = await pb.collection('push_abos').getFullList({ filter: `mitglied="${mitgliedId}"` });
    if (abos.length) {
      const res = await sendePush(
        abos.map((a) => ({ endpoint: a.endpoint, p256dh: a.p256dh, auth: a.auth })),
        {
          titel: `${mahnstufeName(neueStufe)} – Mitgliedsbeitrag`,
          text: `Offen: ${eur(st.offenerBetrag)} € (${st.offeneMonate} Monat${st.offeneMonate === 1 ? '' : 'e'}). Bitte im Verein begleichen.`,
        },
      );
      for (const a of abos) {
        if (res.tot.includes(a.endpoint)) {
          try {
            await pb.collection('push_abos').delete(a.id);
          } catch {
            /* egal */
          }
        }
      }
    }
  } catch {
    /* Push ist optional - Mahnstufe ist gesetzt, Vorstand kann zusaetzlich schriftlich mahnen */
  }

  await protokolliere(pb, mitglied, 'mahnung.gesendet', {
    objektTyp: 'mitglied', objektId: mitgliedId,
    objektLabel: `${u.mitgliedsnummer || ''} ${[u.vorname, u.nachname].filter(Boolean).join(' ') || u.name || ''}`.trim(),
    details: `${mahnstufeName(neueStufe)} · offen ${st.offenerBetrag.toFixed(2)} €`,
  });

  return redirect('/mitglieder/beitraege/status?ok=mahnung', 303);
};

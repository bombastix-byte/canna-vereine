import type { APIRoute } from 'astro';
import { neuePb } from '../../lib/pb';
import { berlinTag } from '../../lib/ausgabe';
import { sendePush } from '../../lib/push';
import { protokolliere } from '../../lib/audit';
import { berechneErinnerungen, type ErinnerungUser, type ErinnerungCharge, type Erinnerung } from '../../lib/erinnerungen';
import { hatBeitraege } from '../../lib/funktionen';

// Erinnerungs-Automatik. Wird täglich vom PocketBase-Cron-Hook aufgerufen
// (http://astro-<verein>:4321/api/erinnerungen?token=…). Läuft mit einem
// dedizierten System-Konto (Vorstand-Rolle), das nur hier verwendet wird.
// Nicht für Menschen gedacht -> reine Maschinen-Schnittstelle.
export const prerender = false;

function env(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  return (import.meta.env as Record<string, string | undefined>)[key];
}

interface Abo { id: string; mitglied: string; endpoint: string; p256dh: string; auth: string }

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token') ?? '';
  const erwartet = env('CRON_TOKEN');
  if (!erwartet || token !== erwartet) {
    return new Response('forbidden', { status: 403 });
  }

  const systemEmail = env('SYSTEM_EMAIL');
  const systemPw = env('SYSTEM_PW');
  if (!systemEmail || !systemPw) {
    return new Response(JSON.stringify({ ok: false, grund: 'system-konto fehlt' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  const pb = neuePb();
  let akteur = { id: '', name: 'System (Automatik)' };
  try {
    const auth = await pb.collection('users').authWithPassword(systemEmail, systemPw);
    akteur = { id: auth.record.id, name: 'System (Automatik)' };
  } catch {
    return new Response(JSON.stringify({ ok: false, grund: 'system-login fehlgeschlagen' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  const heute = berlinTag();
  async function alle<T>(c: string, opts: Record<string, unknown> = {}): Promise<T[]> {
    try {
      return (await pb.collection(c).getFullList(opts)) as T[];
    } catch {
      return [];
    }
  }

  const users = await alle<ErinnerungUser & { rollen?: string[] }>('users', {
    fields: 'id,mitgliedsnummer,vorname,nachname,name,geburtsdatum,beitrag_monatlich,beitrag_bis,mitglied_status,austritt_zum,rollen',
  });
  const chargen = await alle<ErinnerungCharge>('chargen', {
    filter: 'status = "geerntet"',
    fields: 'id,charge_nr,sorte_name,status,ernte_datum',
  });
  const abos = await alle<Abo>('push_abos');

  const erinnerungen = berechneErinnerungen(users, chargen, heute).filter(
    (e) => hatBeitraege || e.typ !== 'beitrag',
  );

  // Rollen-Index für Gruppenziele.
  const rollenVon = new Map(users.map((u) => [u.id, (u as { rollen?: string[] }).rollen ?? []]));
  const abosFuerMitglied = (id: string) => abos.filter((a) => a.mitglied === id);
  const abosFuerRolle = (rollen: string[]) =>
    abos.filter((a) => {
      const r = rollenVon.get(a.mitglied) ?? [];
      return rollen.some((x) => r.includes(x));
    });

  function zielAbos(e: Erinnerung): Abo[] {
    if (e.ziel.art === 'mitglied') return abosFuerMitglied(e.ziel.mitgliedId);
    if (e.ziel.art === 'anbau') return abosFuerRolle(['anbau', 'vorstand']);
    return abosFuerRolle(['ausgabe', 'vorstand']);
  }

  let gesendet = 0;
  const tot = new Set<string>();
  for (const e of erinnerungen) {
    const ziele = zielAbos(e);
    if (!ziele.length) continue;
    const res = await sendePush(
      ziele.map((a) => ({ endpoint: a.endpoint, p256dh: a.p256dh, auth: a.auth })),
      { titel: e.titel, text: e.text, url: e.url },
    );
    gesendet += res.gesendet;
    res.tot.forEach((t) => tot.add(t));
  }

  // Tote Abos entfernen.
  for (const a of abos) {
    if (tot.has(a.endpoint)) {
      try { await pb.collection('push_abos').delete(a.id); } catch { /* egal */ }
    }
  }

  // Lauf protokollieren (nur wenn es etwas zu melden gab, hält das Log schlank).
  if (erinnerungen.length > 0) {
    const zusammen = erinnerungen.reduce((m: Record<string, number>, e) => ((m[e.typ] = (m[e.typ] ?? 0) + 1), m), {});
    await protokolliere(pb, akteur, 'erinnerung.lauf', {
      objektTyp: 'system', objektId: heute,
      details: `${erinnerungen.length} Erinnerung(en), ${gesendet} Push · ` +
        Object.entries(zusammen).map(([k, v]) => `${k}:${v}`).join(', '),
    });
  }

  return new Response(
    JSON.stringify({ ok: true, heute, erinnerungen: erinnerungen.length, gesendet }),
    { headers: { 'content-type': 'application/json' } },
  );
};

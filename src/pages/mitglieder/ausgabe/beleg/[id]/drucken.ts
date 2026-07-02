import type { APIRoute } from 'astro';
import net from 'node:net';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../../../lib/pb';
import { darfAusgeben } from '../../../../../lib/rollen';
import { belegZpl } from '../../../../../lib/zpl';
import { site } from '../../../../../config';

// Sendet das Abgabe-Etikett als ZPL an einen Netzwerk-Etikettendrucker
// (Zebra/TSC/Godex u. a., roher Druck an TCP-Port 9100). Ist kein Drucker
// konfiguriert (PRINTER_HOST), wird die ZPL-Datei zum manuellen Senden geliefert.
export const prerender = false;

const PRINTER_HOST = process.env.PRINTER_HOST;
const PRINTER_PORT = Number(process.env.PRINTER_PORT ?? '9100');

function sendeZpl(host: string, port: number, zpl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port }, () => {
      sock.write(zpl, () => sock.end());
    });
    sock.setTimeout(4000, () => {
      sock.destroy();
      reject(new Error('timeout'));
    });
    sock.on('error', reject);
    sock.on('close', () => resolve());
  });
}

export const POST: APIRoute = async ({ params, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAusgeben(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const { id } = params;
  let a;
  try {
    a = await pb.collection('ausgaben').getOne(id!);
  } catch {
    return redirect('/mitglieder/ausgabe?fehler=1&msg=Beleg+nicht+gefunden', 303);
  }

  // Alle Positionen des Vorgangs (gleiche Belegnummer) auf EIN Etikett.
  let positionen = [a];
  if (a.belegnr) {
    try {
      positionen = await pb.collection('ausgaben').getFullList({
        filter: `belegnr="${a.belegnr}" && mitglied="${a.mitglied}"`,
        sort: 'created',
      });
    } catch {
      positionen = [a];
    }
  }

  const zpl = belegZpl({
    verein: site.vereinsname,
    ort: `${site.kontakt.plz} ${site.kontakt.ort}`,
    belegnr: a.belegnr,
    datum: a.tag,
    mitgliedsnummer: a.mitgliedsnummer,
    positionen: positionen.map((p) => ({
      sorte: p.sorte_name,
      charge: p.charge,
      menge_gramm: p.menge_gramm,
      thc_prozent: p.thc_prozent,
      cbd_prozent: p.cbd_prozent,
      beitrag_euro: p.beitrag_euro,
    })),
  });

  // Kein Drucker konfiguriert -> ZPL-Datei zum manuellen Senden liefern.
  if (!PRINTER_HOST) {
    return new Response(zpl, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': `attachment; filename="beleg-${a.belegnr ?? id}.zpl"`,
      },
    });
  }

  try {
    await sendeZpl(PRINTER_HOST, PRINTER_PORT, zpl);
  } catch {
    return redirect(`/mitglieder/ausgabe/beleg/${id}?druckfehler=1`, 303);
  }
  return redirect(`/mitglieder/ausgabe/beleg/${id}?gedruckt=1`, 303);
};

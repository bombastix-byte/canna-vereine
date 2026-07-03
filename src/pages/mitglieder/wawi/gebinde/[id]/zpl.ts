import type { APIRoute } from 'astro';
import net from 'node:net';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../../../lib/pb';
import { darfAnbau, darfAusgeben } from '../../../../../lib/rollen';
import { gebindeZplStapel } from '../../../../../lib/zpl';
import { produktLabel } from '../../../../../lib/verarbeitung';
import { site } from '../../../../../config';

// Sendet N Gebinde-Etiketten einer Charge als ZPL an den Netzwerk-
// Etikettendrucker (PRINTER_HOST:9100). Ohne Drucker -> ZPL-Datei-Download.
export const prerender = false;

const PRINTER_HOST = process.env.PRINTER_HOST;
const PRINTER_PORT = Number(process.env.PRINTER_PORT ?? '9100');

function sendeZpl(host: string, port: number, zpl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port }, () => sock.write(zpl, () => sock.end()));
    sock.setTimeout(6000, () => { sock.destroy(); reject(new Error('timeout')); });
    sock.on('error', reject);
    sock.on('close', () => resolve());
  });
}

export const POST: APIRoute = async ({ params, url, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen) && !darfAusgeben(mitglied.rollen)) {
    return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);
  }

  const { id } = params;
  let charge;
  try {
    charge = await pb.collection('chargen').getOne(id!);
  } catch {
    return redirect('/mitglieder/wawi', 303);
  }
  if (!charge.charge_nr) return redirect('/mitglieder/wawi', 303);

  const anzahl = Math.min(60, Math.max(1, Number(url.searchParams.get('n')) || 12));
  const zpl = gebindeZplStapel(
    {
      verein: site.kurzname,
      chargeNr: charge.charge_nr,
      sorte: charge.sorte_name,
      produkt: produktLabel(charge.produkt_typ),
      thcProzent: charge.thc_prozent != null ? Number(charge.thc_prozent) : null,
    },
    anzahl,
  );

  if (!PRINTER_HOST) {
    return new Response(zpl, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': `attachment; filename="gebinde-${charge.charge_nr}.zpl"`,
      },
    });
  }
  try {
    await sendeZpl(PRINTER_HOST, PRINTER_PORT, zpl);
  } catch {
    return redirect(`/mitglieder/wawi/gebinde/${id}?druckfehler=1`, 303);
  }
  return redirect(`/mitglieder/wawi/gebinde/${id}?gedruckt=1`, 303);
};

import type { APIRoute } from 'astro';
import net from 'node:net';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../../../lib/pb';
import { darfAnbau } from '../../../../../lib/rollen';
import { pflanzenZplStapel } from '../../../../../lib/zpl';
import { site } from '../../../../../config';

// Sendet alle Pflanzen-Etiketten einer Charge als ZPL an den Netzwerk-
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

export const POST: APIRoute = async ({ params, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const { id } = params;
  let charge;
  try {
    charge = await pb.collection('chargen').getOne(id!);
  } catch {
    return redirect('/mitglieder/wawi', 303);
  }

  let pflanzen: Array<Record<string, any>> = [];
  try {
    pflanzen = await pb.collection('pflanzen').getFullList({ filter: `charge_ref="${id}" && status!="vernichtet"`, sort: 'nummer' });
  } catch {
    pflanzen = [];
  }
  if (pflanzen.length === 0) return redirect(`/mitglieder/wawi/etiketten/${id}`, 303);

  const zpl = pflanzenZplStapel(
    pflanzen.map((p) => ({ verein: site.kurzname, charge: charge.charge_nr, sorte: charge.sorte_name, nummer: p.nummer })),
  );

  if (!PRINTER_HOST) {
    return new Response(zpl, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': `attachment; filename="etiketten-${charge.charge_nr ?? id}.zpl"`,
      },
    });
  }
  try {
    await sendeZpl(PRINTER_HOST, PRINTER_PORT, zpl);
  } catch {
    return redirect(`/mitglieder/wawi/etiketten/${id}?druckfehler=1`, 303);
  }
  return redirect(`/mitglieder/wawi/etiketten/${id}?gedruckt=1`, 303);
};

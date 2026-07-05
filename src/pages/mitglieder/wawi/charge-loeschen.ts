import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { darfAnbau } from '../../../lib/rollen';
import { protokolliere } from '../../../lib/audit';

// Charge löschen — NUR wenn keine verknüpften, rechtlich relevanten Datensätze
// existieren (Abgaben, Pflanzen, Vernichtungen, Transporte). Sonst bleibt die
// Charge erhalten und ist zu „sperren". So verwaisen keine Nachweise. Auditiert.
// Nur Anbau/Vorstand.
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);
  const { pb, mitglied } = ergebnis;
  if (!darfAnbau(mitglied.rollen)) return redirect('/mitglieder/bereich?fehler=keinzugriff', 303);

  const daten = await request.formData();
  const id = String(daten.get('charge') ?? '').trim();
  if (!id) return redirect('/mitglieder/wawi', 303);
  const zurueck = (q: string) => redirect(`/mitglieder/wawi/charge/${id}?${q}`, 303);

  let charge: Record<string, any>;
  try {
    charge = await pb.collection('chargen').getOne(id);
  } catch {
    return redirect('/mitglieder/wawi?fehler=fehlgeschlagen', 303);
  }

  // Abhängigkeiten prüfen (jede würde einen Nachweis verwaisen lassen).
  async function zaehle(collection: string, filter: string): Promise<number> {
    try {
      return (await pb.collection(collection).getList(1, 1, { filter })).totalItems;
    } catch {
      return 0;
    }
  }
  const abgaben = await zaehle('ausgaben', `charge_ref="${id}"`);
  const pflanzen = await zaehle('pflanzen', `charge_ref="${id}"`);
  const vernicht = await zaehle('vernichtungen', `charge_nr="${charge.charge_nr}"`);
  const transporte = await zaehle('transporte', `charge_nr="${charge.charge_nr}"`);
  if (abgaben + pflanzen + vernicht + transporte > 0) {
    // Nicht löschbar -> Hinweis, stattdessen sperren.
    return zurueck('fehler=verknuepft');
  }

  try {
    await pb.collection('chargen').delete(id);
  } catch {
    return zurueck('fehler=fehlgeschlagen');
  }

  await protokolliere(pb, mitglied, 'charge.geloescht', {
    objektTyp: 'charge', objektId: id, objektLabel: charge.charge_nr || id,
    details: `${charge.sorte_name ?? ''} · Status ${charge.status ?? ''}`,
  });
  return redirect('/mitglieder/wawi?ok=geloescht', 303);
};

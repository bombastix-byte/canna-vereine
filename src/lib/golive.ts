import type { SiteConfig } from '../config/types';

function texte(objekt: unknown, pfad = ''): Array<{ pfad: string; wert: string }> {
  if (typeof objekt === 'string') return [{ pfad, wert: objekt }];
  if (Array.isArray(objekt)) return objekt.flatMap((wert, i) => texte(wert, `${pfad}[${i}]`));
  if (objekt && typeof objekt === 'object') {
    return Object.entries(objekt).flatMap(([key, wert]) => texte(wert, pfad ? `${pfad}.${key}` : key));
  }
  return [];
}

export function goliveBlocker(site: SiteConfig, opts: {
  domain?: string;
  avvBestaetigt?: boolean;
  kasseEntschieden?: boolean;
} = {}): string[] {
  const blocker = texte(site)
    .filter(({ wert }) => /TODO|example\.(de|com)|nip\.io/i.test(wert))
    .map(({ pfad, wert }) => `${pfad}: ${wert}`);

  if (!opts.domain || /nip\.io|example\.(de|com)|localhost/i.test(opts.domain)) {
    blocker.push('domain: echte Produktionsdomain fehlt');
  }
  if (!opts.avvBestaetigt) blocker.push('avv: Auftragsverarbeitungsvertrag nicht bestaetigt');
  if (!opts.kasseEntschieden) blocker.push('kasse: Kassen-/TSE-Entscheidung nicht bestaetigt');
  return blocker;
}

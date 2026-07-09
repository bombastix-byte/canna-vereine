// Zentrale Anzeige eines Mitglieds. Im datensparsamen Modus (login_modus
// 'mitgliedsnummer') wird NIE ein Klarname gezeigt — nur der frei gewählte
// Alias oder „Mitglied M-###". So kann kein Name durchrutschen, auch wenn in
// Altdaten noch einer stünde.
import { site } from '../config';

export interface AnzeigePerson {
  alias?: string;
  name?: string;
  vorname?: string;
  nachname?: string;
  mitgliedsnummer?: string;
  email?: string;
}

export function anzeigeName(u?: AnzeigePerson | null): string {
  if (!u) return 'Mitglied';
  const alias = (u.alias ?? '').trim();
  if (alias) return alias;
  if (site.login_modus === 'mitgliedsnummer') {
    return u.mitgliedsnummer ? `Mitglied ${u.mitgliedsnummer}` : 'Mitglied';
  }
  return (
    u.name ||
    [u.vorname, u.nachname].filter(Boolean).join(' ') ||
    u.mitgliedsnummer ||
    u.email ||
    'Mitglied'
  );
}

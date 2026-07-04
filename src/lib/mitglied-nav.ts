// Zentrale Definition der Mitglieder-Navigation. Wird von der Seitenleiste
// (Layout "sidebar") und der klassischen MitgliedNav-Leiste (Layout
// "standard"/"zentriert") gemeinsam genutzt - ein Ort fuer Punkte + Rechte.
import { darfAusgeben, darfAnbau, darfBerichte, darfVerwalten } from './rollen';

export interface NavPunkt {
  label: string;
  href: string;
  /** Weitere Pfade, die diesen Punkt als aktiv markieren (gebuendelte Seiten). */
  auch?: string[];
}

/** Punkte fuer alle Mitglieder. */
export const MITGLIED_PUNKTE: NavPunkt[] = [
  { label: 'Aktuelles', href: '/mitglieder/bereich' },
  { label: 'Angebot der Woche', href: '/mitglieder/wochenangebot' },
  { label: 'Vorbestellung', href: '/mitglieder/vorbestellung' },
  { label: 'Helferplan', href: '/mitglieder/helferplan' },
  { label: 'Abstimmungen', href: '/mitglieder/abstimmungen' },
  { label: 'Wissen', href: '/mitglieder/anleitungen', auch: ['/mitglieder/sortenberichte', '/mitglieder/praevention'] },
  { label: 'Ausweis', href: '/mitglieder/ausweis' },
  { label: 'App', href: '/mitglieder/app' },
  { label: 'Sicherheit', href: '/mitglieder/sicherheit' },
];

/** Vereinsarbeits-Punkte je nach Rollen (leeres Array fuer reine Mitglieder). */
export function arbeitPunkteFuer(rollen?: string[]): NavPunkt[] {
  const punkte: NavPunkt[] = [];
  if (darfAusgeben(rollen)) {
    // Tresen buendelt Abgabe (Bluete/Haschisch/Rosin) und Samen/Stecklinge.
    punkte.push({ label: 'Tresen', href: '/mitglieder/ausgabe' });
  }
  if (darfAnbau(rollen)) {
    punkte.push({ label: 'Anbau heute', href: '/mitglieder/anbau' });
    punkte.push({ label: 'Warenwirtschaft', href: '/mitglieder/wawi' });
  }
  if (darfBerichte(rollen)) {
    punkte.push({ label: 'Jahresmeldung', href: '/mitglieder/jahresmeldung' });
  }
  if (darfVerwalten(rollen)) {
    punkte.push({
      label: 'Verwaltung',
      href: '/mitglieder/verwaltung',
      auch: ['/mitglieder/antraege', '/mitglieder/beitraege', '/mitglieder/nachricht'],
    });
  }
  return punkte;
}

/** Ist der Punkt fuer den aktuellen Pfad aktiv (inkl. gebuendelter Seiten)? */
export function istAktiv(p: NavPunkt, pfadname: string): boolean {
  const aktuell = pfadname.replace(/\/$/, '');
  return [p.href, ...(p.auch ?? [])].some((h) => aktuell === h || aktuell.startsWith(h + '/'));
}

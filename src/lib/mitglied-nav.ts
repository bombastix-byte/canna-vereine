// Zentrale Definition der Mitglieder-Navigation. Wird von der Seitenleiste
// (Layout "sidebar") und der klassischen MitgliedNav-Leiste (Layout
// "standard"/"zentriert") gemeinsam genutzt - ein Ort fuer Punkte + Rechte.
// Die abschaltbaren Module kommen als Laufzeit-Flags (locals.funktionen) herein.
import { darfAusgeben, darfAnbau, darfBerichte, darfVerwalten, istPersonal } from './rollen';
import type { Funktionen } from './einstellungen';
import { uebersetzer, type Sprache } from './i18n';

/**
 * Startseite direkt nach der Anmeldung. Einfache Mitglieder landen auf dem
 * digitalen Ausweis (am Tresen sofort vorzeigbar); Personal auf dem
 * Dashboard „Aktuelles".
 */
export function startseiteFuer(rollen?: string[]): string {
  return istPersonal(rollen) ? '/mitglieder/bereich' : '/mitglieder/ausweis';
}

export interface NavPunkt {
  label: string;
  href: string;
  /** Weitere Pfade, die diesen Punkt als aktiv markieren (gebuendelte Seiten). */
  auch?: string[];
}

/** An = Modul aktiv (Default an, wenn keine Flags geladen wurden). */
function an(fn: Funktionen | undefined, key: keyof Funktionen): boolean {
  return fn ? fn[key] !== false : true;
}

/** Punkte fuer alle Mitglieder. Abschaltbare Module werden je Verein gefiltert,
 *  Labels folgen der gewaehlten Sprache. */
export function mitgliedPunkte(fn?: Funktionen, sprache: Sprache = 'de'): NavPunkt[] {
  const t = uebersetzer(sprache);
  return [
    { label: t('nav.aktuelles'), href: '/mitglieder/bereich' },
    { label: t('nav.angebot'), href: '/mitglieder/wochenangebot' },
    ...(an(fn, 'vorbestellung') ? [{ label: t('nav.vorbestellung'), href: '/mitglieder/vorbestellung' }] : []),
    ...(an(fn, 'termine') ? [{ label: t('nav.termine'), href: '/mitglieder/termine' }] : []),
    ...(an(fn, 'helferplan') ? [{ label: t('nav.helferplan'), href: '/mitglieder/helferplan' }] : []),
    ...(an(fn, 'abstimmungen') ? [{ label: t('nav.abstimmungen'), href: '/mitglieder/abstimmungen' }] : []),
    ...(an(fn, 'brett') ? [{ label: t('nav.brett'), href: '/mitglieder/brett' }] : []),
    { label: t('nav.wissen'), href: '/mitglieder/anleitungen', auch: ['/mitglieder/sortenberichte', '/mitglieder/praevention'] },
    { label: t('nav.ausweis'), href: '/mitglieder/ausweis' },
    { label: t('nav.konto'), href: '/mitglieder/profil' },
    { label: t('nav.app'), href: '/mitglieder/app' },
    { label: t('nav.sicherheit'), href: '/mitglieder/sicherheit' },
  ];
}

/** Vereinsarbeits-Punkte je nach Rollen (leeres Array fuer reine Mitglieder). */
export function arbeitPunkteFuer(rollen?: string[], fn?: Funktionen): NavPunkt[] {
  const punkte: NavPunkt[] = [];
  if (darfAusgeben(rollen)) {
    // Ausgabe buendelt Abgabe (Bluete/Haschisch/Rosin) und Samen/Stecklinge.
    punkte.push({ label: 'Ausgabe', href: '/mitglieder/ausgabe' });
    if (an(fn, 'kasse')) punkte.push({ label: 'Kasse', href: '/mitglieder/kasse' });
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

/** Reiter des Verwaltungs-Bereichs (Vorstand). Abschaltbare Reiter je nach Modul. */
export function verwaltungTabs(fn?: Funktionen): { label: string; href: string }[] {
  return [
    { label: 'Mitglieder & Rollen', href: '/mitglieder/verwaltung' },
    ...(an(fn, 'antraege') ? [{ label: 'Anträge', href: '/mitglieder/antraege' }] : []),
    ...(an(fn, 'beitraege')
      ? [
          { label: 'Beiträge', href: '/mitglieder/beitraege' },
          { label: 'Zahlungen', href: '/mitglieder/beitraege/status' },
        ]
      : []),
    ...(an(fn, 'push') ? [{ label: 'Nachricht', href: '/mitglieder/nachricht' }] : []),
    { label: 'Module', href: '/mitglieder/verwaltung/module' },
    { label: 'Protokoll', href: '/mitglieder/verwaltung/protokoll' },
  ];
}

/** Ist der Punkt fuer den aktuellen Pfad aktiv (inkl. gebuendelter Seiten)? */
export function istAktiv(p: NavPunkt, pfadname: string): boolean {
  const aktuell = pfadname.replace(/\/$/, '');
  return [p.href, ...(p.auch ?? [])].some((h) => aktuell === h || aktuell.startsWith(h + '/'));
}

import type { SiteConfig, NavPunkt } from './types';
import { goerlitz } from './goerlitz';

// Registry aller Vereinsseiten. Weitere Seite: Config importieren und ergaenzen.
const sites: Record<string, SiteConfig> = {
  goerlitz,
  // leipzig,
};

// Welche Seite gebaut/ausgeliefert wird, steuert SITE_ID (Default: goerlitz).
const aktiveId = (import.meta.env.SITE_ID as string | undefined) ?? 'goerlitz';

export const site: SiteConfig = sites[aktiveId] ?? goerlitz;

// Zentrale, fuer alle Vereine identische Navigation. Bewusst nuechtern,
// ohne werbende Begriffe, rein nach Informationszweck gegliedert.
export const navigation: NavPunkt[] = [
  { label: 'Start', href: '/' },
  { label: 'Aufnahmeverfahren', href: '/aufnahmeverfahren' },
  { label: 'Satzung und Beitraege', href: '/satzung-beitraege' },
  { label: 'Gesundheit und Jugendschutz', href: '/gesundheit-jugendschutz' },
  { label: 'Praevention und Beratung', href: '/praevention-beratung' },
  { label: 'Anbau und Sorten', href: '/anbau-sorten' },
  { label: 'Rechtliche Hinweise', href: '/rechtliche-hinweise' },
  { label: 'Kontakt', href: '/kontakt' },
];

export type { SiteConfig, NavPunkt };

import type { SiteConfig, NavPunkt } from './types';
import { goerlitz } from './goerlitz';
import { goerlitz2 } from './goerlitz2';
import { leipzig } from './leipzig';

// Registry aller Vereinsseiten. Weitere Seite: Config importieren und ergänzen.
const sites: Record<string, SiteConfig> = {
  goerlitz,
  goerlitz2,
  leipzig,
};

// Welche Seite gebaut/ausgeliefert wird, steuert SITE_ID (Default: goerlitz).
const aktiveId = (import.meta.env.SITE_ID as string | undefined) ?? 'goerlitz';

export const site: SiteConfig = sites[aktiveId] ?? goerlitz;

// Zentrale, für alle Vereine identische Navigation. Bewusst nüchtern,
// ohne werbende Begriffe, rein nach Informationszweck gegliedert.
export const navigation: NavPunkt[] = [
  { label: 'Start', href: '/' },
  { label: 'Mitglied werden', href: '/mitglied-werden' },
  { label: 'Prävention und Beratung', href: '/praevention-beratung' },
  { label: 'Rechtliche Hinweise', href: '/rechtliche-hinweise' },
  { label: 'Kontakt', href: '/kontakt' },
];

export type { SiteConfig, NavPunkt };

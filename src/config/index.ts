import type { SiteConfig, NavPunkt } from './types';
import { goerlitz } from './goerlitz';
import { goerlitz2 } from './goerlitz2';
import { leipzig } from './leipzig';
import { cvg } from './cvg';
export { produkt } from './produkt';

// Registry aller Vereinsseiten. Weitere Seite: Config importieren und ergänzen.
const sites: Record<string, SiteConfig> = {
  goerlitz,
  goerlitz2,
  leipzig,
  cvg,
};

// Welche Seite ausgeliefert wird, steuert SITE_ID. Wird zur Build-Zeit
// (import.meta.env, statischer Build) ODER zur Laufzeit (process.env im
// Node-Server, ein Image für alle Vereine) gelesen. Default: goerlitz.
const aktiveId =
  (import.meta.env.SITE_ID as string | undefined) ||
  (typeof process !== 'undefined' ? process.env?.SITE_ID : undefined) ||
  'goerlitz';

export const site: SiteConfig = sites[aktiveId] ?? goerlitz;

// Zentrale, für alle Vereine identische Navigation. Bewusst nüchtern,
// ohne werbende Begriffe, rein nach Informationszweck gegliedert.
export const navigation: NavPunkt[] = [
  { label: 'Start', href: '/' },
  // BEWUSST NICHT verlinkt: /mitglied-werden. Ein öffentlich beworbener
  // "Mitglied werden"-Punkt könnte als Werbung i. S. v. Paragraf 6 KCanG
  // gelesen werden. Die Antragsseite bleibt unter ihrer URL erreichbar -
  // der Verein gibt den Link nur auf direkte Anfrage weiter.
  { label: 'Prävention und Beratung', href: '/praevention-beratung' },
  { label: 'Rechtliche Hinweise', href: '/rechtliche-hinweise' },
  { label: 'Kontakt', href: '/kontakt' },
];

export type { SiteConfig, NavPunkt };

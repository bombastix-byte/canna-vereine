// Datenmodell für eine Anbauvereinigungs-Website.
// Alle sichtbaren Inhalte einer Seite stammen aus genau einer SiteConfig,
// damit eine weitere Vereinsseite nur eine neue Config-Datei benötigt.

// Visuelles Theme. Ändert Schrift, Farbe und Anmutung (Token-Ebene).
export type ThemeName = 'botanik' | 'klar' | 'warm' | 'nacht';

// Layout. Bestimmt die Grundstruktur, unabhängig vom Theme:
//  'standard'  = Kopfleiste oben mit horizontaler Navigation (Default)
//  'sidebar'   = feste Seitenleiste am Desktop, Hamburger-Menü am Handy
//  'zentriert' = zentrierter Masthead mit mittiger Navigation (formell)
// Alle Layouts nutzen am Handy ein Hamburger-Menü.
export type LayoutName = 'standard' | 'sidebar' | 'zentriert';

export interface Ansprechpartner {
  name: string;
  rolle: string;
  email?: string;
  telefon?: string;
}

export interface Beratungsstelle {
  name: string;
  beschreibung: string;
  telefon?: string;
  url?: string;
}

export interface NavPunkt {
  label: string;
  href: string;
}

export interface SiteConfig {
  /** technische Kennung, identisch mit Dateiname ohne Endung */
  id: string;
  /** visuelles Theme dieser Vereinsseite */
  theme: ThemeName;
  /** Grundlayout (Default: standard) */
  layout?: LayoutName;
  /**
   * Duerfen Suchmaschinen die Seite aufnehmen? Default FALSE: waehrend der
   * Entwicklung bekommt ALLES noindex/nofollow + robots.txt "Disallow: /".
   * Erst zum Livegang mit echter Domain bewusst auf true stellen.
   */
  indexierbar?: boolean;
  /**
   * Gibt es einen oeffentlichen Web-Auftritt? Default TRUE. Bei false
   * (Vereinskonzept "keine Website") leiten alle oeffentlichen Seiten zur
   * Anmeldung um; erreichbar bleiben nur Login, Impressum und Datenschutz
   * (Impressumspflicht gilt auch fuer eine reine Login-Seite).
   */
  oeffentlich?: boolean;
  /** vollständiger Vereinsname laut Satzung */
  vereinsname: string;
  /** kurzer Name für Kopfzeile/Titel */
  kurzname: string;
  stadt: string;
  /** Vereinsregister, z. B. "VR 12345, Amtsgericht Dresden" */
  registereintrag?: string;
  /** Erlaubnis-/Aktenzeichen der zuständigen Behörde, falls vorhanden */
  erlaubnisHinweis?: string;

  kontakt: {
    strasse: string;
    plz: string;
    ort: string;
    email: string;
    telefon?: string;
    /** rein sachlich: Zeiten der telefonischen/persönlichen Erreichbarkeit */
    erreichbarkeit?: string;
    /** Besuchszeiten vor Ort, rein sachlich (z. B. "Werktags 14 bis 18 Uhr") */
    besuchszeiten?: string;
  };

  vorstand: Ansprechpartner[];
  praeventionsbeauftragter: Ansprechpartner;
  externeBeratung: Beratungsstelle[];

  /** Pfade zu Downloads im /public-Ordner, leer lassen wenn noch nicht vorhanden */
  dokumente: {
    satzungPdf?: string;
    beitragsordnungPdf?: string;
    gesundheitskonzeptPdf?: string;
    jugendschutzkonzeptPdf?: string;
  };

  /** wird im Footer und Impressum verwendet */
  impressum: {
    vertretungsberechtigt: string;
    ustId?: string;
    inhaltlichVerantwortlich: string;
  };
}

// Datenmodell fuer eine Anbauvereinigungs-Website.
// Alle sichtbaren Inhalte einer Seite stammen aus genau einer SiteConfig,
// damit eine weitere Vereinsseite nur eine neue Config-Datei benoetigt.

// Visuelles Theme. Aendert Schrift, Farbe und Anmutung (Token-Ebene).
export type ThemeName = 'botanik' | 'klar' | 'warm' | 'nacht';

// Layout. Bestimmt die Grundstruktur, unabhaengig vom Theme:
//  'standard' = Kopfleiste oben (Default)
//  'sidebar'  = feste Seitenleiste am Desktop, Hamburger-Menue am Handy
export type LayoutName = 'standard' | 'sidebar';

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
  /** vollstaendiger Vereinsname laut Satzung */
  vereinsname: string;
  /** kurzer Name fuer Kopfzeile/Titel */
  kurzname: string;
  stadt: string;
  /** Vereinsregister, z. B. "VR 12345, Amtsgericht Dresden" */
  registereintrag?: string;
  /** Erlaubnis-/Aktenzeichen der zustaendigen Behoerde, falls vorhanden */
  erlaubnisHinweis?: string;

  kontakt: {
    strasse: string;
    plz: string;
    ort: string;
    email: string;
    telefon?: string;
    /** rein sachlich: Zeiten der telefonischen/persoenlichen Erreichbarkeit */
    erreichbarkeit?: string;
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

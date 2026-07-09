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

/**
 * Funktions-Module, die je Verein abschaltbar sind. Alles ist standardmäßig AN;
 * nur ausdrücklich auf `false` gesetzte Module verschwinden aus Navigation,
 * Cockpit und Automatik (die Seiten selbst leiten dann ebenfalls ab).
 */
export interface Funktionen {
  /**
   * Laufende Mitgliedsbeiträge inkl. SEPA-Lastschrift und Mahnwesen.
   * Vereine, die sich nur über einen einmaligen Aufnahmebeitrag finanzieren
   * (z. B. CVG), setzen dies auf `false` — dann verschwinden die Reiter
   * „Beiträge" und „Zahlungen", die SEPA-/IBAN-Felder und die Beitrags-Erinnerung.
   */
  beitraege?: boolean;
  /** Weiterverarbeitung zu Haschisch/Rosin (Warenwirtschaft). Reine-Blüte-Vereine: false. */
  verarbeitung?: boolean;
  /** Kassenbuch & Tagesabschluss (Nav-Punkt „Kasse", Cockpit-Kachel). */
  kasse?: boolean;
  /** Vorbestellungen durch Mitglieder. */
  vorbestellung?: boolean;
  /** Termine mit Zu-/Absage (RSVP). */
  termine?: boolean;
  /** Helferplan / Helferdienste. */
  helferplan?: boolean;
  /** Mitglieder-Abstimmungen. */
  abstimmungen?: boolean;
  /** Online-Beitrittsanträge (Reiter „Anträge", öffentliches Beitrittsformular, Cockpit-Kachel). */
  antraege?: boolean;
  /** Push-Benachrichtigungen gesamt (Reiter „Nachricht", Erinnerungs-Automatik, Push-Abo). */
  push?: boolean;
  /** Sortenbewertung durch Mitglieder (Sterne + Kommentar). */
  bewertungen?: boolean;
  /** Schwarzes Brett (Beiträge + Antworten der Mitglieder). */
  brett?: boolean;
}

/** Schlüssel der abschaltbaren Module (für generische Prüfungen). */
export type FunktionsSchluessel = keyof Funktionen;

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
  /** Kürzel des Vereins (z. B. "CVG"), als Untertitel im App-Kopf. */
  kuerzel?: string;
  stadt: string;
  /** Vereinsregister, z. B. "VR 12345, Amtsgericht Dresden" */
  registereintrag?: string;
  /** Erlaubnis-/Aktenzeichen der zuständigen Behörde, falls vorhanden */
  erlaubnisHinweis?: string;

  /** Abschaltbare Funktions-Module (siehe Funktionen). Fehlt es, ist alles an. */
  funktionen?: Funktionen;
  /**
   * Einmaliger Aufnahmebeitrag in Euro (bar bei Aufnahme). 0/undefined = keiner.
   * Wird beim Aufnehmen eines Mitglieds vorgeschlagen und in die Kasse gebucht.
   */
  aufnahmebeitrag_euro?: number;

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

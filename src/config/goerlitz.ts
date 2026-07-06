import type { SiteConfig } from './types';

// PLATZHALTER: Mit echten Vereinsdaten ersetzen. Felder mit "TODO" müssen
// vor dem Livegang vom Verein geliefert werden.
export const goerlitz: SiteConfig = {
  id: 'goerlitz',
  theme: 'nacht',
  // App-Shell: feste Seitenleiste am Desktop, Hamburger-Schublade am Handy.
  // Angemeldete Mitglieder sehen dort die komplette Mitglieder-Navigation.
  layout: 'sidebar',
  // Vereinskonzept laut Anmeldung: KEIN oeffentlicher Web-Auftritt. Nur
  // Login, Impressum und Datenschutz sind erreichbar; alles andere leitet
  // zur Anmeldung um. Praevention & Beratung lebt im Mitgliederbereich.
  oeffentlich: false,
  //   = geschütztes Leerzeichen: "Görlitz e. V." bricht nie auseinander.
  vereinsname: 'Cannabis-Verein Görlitz e. V.',
  kurzname: 'Cannabis-Verein Görlitz',
  kuerzel: 'CVG',
  stadt: 'Görlitz',
  // Finanzierung des CVG: KEINE laufenden Mitgliedsbeiträge/SEPA/Mahnwesen,
  // nur ein einmaliger Aufnahmebeitrag (bar bei Aufnahme, in die Kasse).
  // Beitritt läuft offline -> Online-Anträge aus. Alles andere aktiv.
  funktionen: { beitraege: false, antraege: false },
  aufnahmebeitrag_euro: 50, // TODO: echten CVG-Aufnahmebeitrag bestätigen
  registereintrag: 'TODO: VR-Nummer, Amtsgericht',
  erlaubnisHinweis:
    'Erlaubnis zum gemeinschaftlichen Eigenanbau nach Paragraf 11 KCanG: TODO Aktenzeichen / Status',

  kontakt: {
    strasse: 'Blumenstr. 10',
    plz: '02826',
    ort: 'Görlitz',
    email: 'cannabisverein.goerlitz@gmail.com',
    telefon: undefined,
    erreichbarkeit: 'Schriftliche Anfragen werden innerhalb weniger Werktage beantwortet.',
    besuchszeiten: 'Werktags 14 bis 18 Uhr',
  },

  vorstand: [
    { name: 'TODO Vorname Nachname', rolle: 'Vorsitz' },
    { name: 'TODO Vorname Nachname', rolle: 'Stellvertretung' },
  ],

  praeventionsbeauftragter: {
    name: 'TODO Vorname Nachname',
    rolle: 'Präventionsbeauftragte Person nach Paragraf 23 KCanG',
    email: 'praevention@TODO-domain.de',
  },

  externeBeratung: [
    {
      name: 'Suchtberatung Diakonie Görlitz',
      beschreibung: 'Kostenlose und vertrauliche Beratung zu Suchtfragen.',
      telefon: 'TODO',
      url: undefined,
    },
    {
      name: 'BZgA: Infotelefon zur Suchtvorbeugung',
      beschreibung: 'Bundeszentrale für gesundheitliche Aufklärung, anonyme Beratung.',
      telefon: '0221 892031',
      url: 'https://www.bzga.de',
    },
    {
      name: 'Sucht und Drogen Hotline',
      beschreibung: 'Bundesweite telefonische Beratung, rund um die Uhr.',
      telefon: '01806 313031',
    },
  ],

  dokumente: {
    satzungPdf: undefined, // z. B. '/dokumente/goerlitz-satzung.pdf'
    beitragsordnungPdf: undefined,
    gesundheitskonzeptPdf: undefined,
    jugendschutzkonzeptPdf: undefined,
  },

  impressum: {
    vertretungsberechtigt: 'TODO Vorstand laut Paragraf 26 BGB',
    ustId: undefined,
    inhaltlichVerantwortlich: 'TODO Name, Anschrift wie oben',
  },
};

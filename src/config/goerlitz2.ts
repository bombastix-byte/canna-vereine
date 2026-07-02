import type { SiteConfig } from './types';

// PLATZHALTER: Zweite Anbauvereinigung in Görlitz. Echte Vereinsdaten
// einsetzen, Felder mit "TODO" vor dem Livegang ersetzen.
export const goerlitz2: SiteConfig = {
  id: 'goerlitz2',
  theme: 'klar',
  layout: 'sidebar',
  vereinsname: 'Cannabis Social Club Görlitz e. V.', // TODO: exakter Name laut Satzung
  kurzname: 'CSC Görlitz',
  stadt: 'Görlitz',
  registereintrag: 'TODO: VR-Nummer, Amtsgericht',
  erlaubnisHinweis:
    'Erlaubnis zum gemeinschaftlichen Eigenanbau nach Paragraf 11 KCanG: TODO Aktenzeichen / Status',

  kontakt: {
    strasse: 'TODO Straße und Hausnummer',
    plz: '02826',
    ort: 'Görlitz',
    email: 'kontakt@TODO-csc-domain.de',
    telefon: undefined,
    erreichbarkeit: 'Schriftliche Anfragen werden innerhalb weniger Werktage beantwortet.',
  },

  vorstand: [
    { name: 'TODO Vorname Nachname', rolle: 'Vorsitz' },
    { name: 'TODO Vorname Nachname', rolle: 'Stellvertretung' },
  ],

  praeventionsbeauftragter: {
    name: 'TODO Vorname Nachname',
    rolle: 'Präventionsbeauftragte Person nach Paragraf 23 KCanG',
    email: 'praevention@TODO-csc-domain.de',
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
    satzungPdf: undefined,
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

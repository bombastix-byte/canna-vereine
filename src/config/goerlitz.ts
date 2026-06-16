import type { SiteConfig } from './types';

// PLATZHALTER: Mit echten Vereinsdaten ersetzen. Felder mit "TODO" muessen
// vor dem Livegang vom Verein geliefert werden.
export const goerlitz: SiteConfig = {
  id: 'goerlitz',
  theme: 'botanik',
  vereinsname: 'Anbauvereinigung Goerlitz e. V.', // TODO: exakter Name laut Satzung
  kurzname: 'Anbauvereinigung Goerlitz',
  stadt: 'Goerlitz',
  registereintrag: 'TODO: VR-Nummer, Amtsgericht',
  erlaubnisHinweis:
    'Erlaubnis zum gemeinschaftlichen Eigenanbau nach Paragraf 11 KCanG: TODO Aktenzeichen / Status',

  kontakt: {
    strasse: 'TODO Strasse und Hausnummer',
    plz: '02826',
    ort: 'Goerlitz',
    email: 'kontakt@TODO-domain.de',
    telefon: undefined,
    erreichbarkeit: 'Schriftliche Anfragen werden innerhalb weniger Werktage beantwortet.',
  },

  vorstand: [
    { name: 'TODO Vorname Nachname', rolle: 'Vorsitz' },
    { name: 'TODO Vorname Nachname', rolle: 'Stellvertretung' },
  ],

  praeventionsbeauftragter: {
    name: 'TODO Vorname Nachname',
    rolle: 'Praeventionsbeauftragte Person nach Paragraf 23 KCanG',
    email: 'praevention@TODO-domain.de',
  },

  externeBeratung: [
    {
      name: 'Suchtberatung Diakonie Goerlitz',
      beschreibung: 'Kostenlose und vertrauliche Beratung zu Suchtfragen.',
      telefon: 'TODO',
      url: undefined,
    },
    {
      name: 'BZgA: Infotelefon zur Suchtvorbeugung',
      beschreibung: 'Bundeszentrale fuer gesundheitliche Aufklaerung, anonyme Beratung.',
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

import type { SiteConfig } from './types';

// PLATZHALTER: Anbauvereinigung in Leipzig. Echte Vereinsdaten einsetzen,
// Felder mit "TODO" vor dem Livegang ersetzen.
export const leipzig: SiteConfig = {
  id: 'leipzig',
  theme: 'warm',
  vereinsname: 'Anbauvereinigung Leipzig e. V.', // TODO: exakter Name laut Satzung
  kurzname: 'Anbauvereinigung Leipzig',
  stadt: 'Leipzig',
  registereintrag: 'TODO: VR-Nummer, Amtsgericht Leipzig',
  erlaubnisHinweis:
    'Erlaubnis zum gemeinschaftlichen Eigenanbau nach Paragraf 11 KCanG: TODO Aktenzeichen / Status',

  kontakt: {
    strasse: 'TODO Strasse und Hausnummer',
    plz: '04109',
    ort: 'Leipzig',
    email: 'kontakt@TODO-leipzig-domain.de',
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
    email: 'praevention@TODO-leipzig-domain.de',
  },

  externeBeratung: [
    {
      name: 'Suchtberatung der Stadt Leipzig',
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

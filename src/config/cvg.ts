import type { SiteConfig } from './types';

// PRODUKTIV-Instanz des Cannabis-Vereins Görlitz (CVG). Getrennt von der
// Demo-/Entwicklungsinstanz `goerlitz` (die mit Beispieldaten stehen bleibt).
// Hier kommen die ECHTEN Vereinsdaten rein. Felder mit "TODO" vor dem finalen
// Livegang ersetzen.
export const cvg: SiteConfig = {
  id: 'cvg',
  theme: 'nacht',
  layout: 'sidebar',
  // Kein oeffentlicher Web-Auftritt: nur Login, Impressum, Datenschutz.
  oeffentlich: false,
  vereinsname: 'Cannabis-Verein Görlitz e. V.',
  kurzname: 'Cannabis-Verein Görlitz',
  kuerzel: 'CVG',
  stadt: 'Görlitz',
  // CVG: keine laufenden Beiträge/SEPA, Beitritt offline, Geld über die
  // vorhandene (externe) Kasse -> internes Kassenmodul aus. Live im Admin änderbar.
  funktionen: { beitraege: false, antraege: false, kasse: false },
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

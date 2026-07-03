// Textvorlagen fuer die automatischen Vereins-Mails. Reine Funktionen
// (Verein + Daten -> { betreff, text }), damit sie ohne SMTP testbar sind.
// Bewusst nuechtern, kein Marketing (KCanG Paragraf 6).

export interface VereinKopf {
  vereinsname: string;
  email: string;
  ort: string;
}

function fuss(v: VereinKopf): string {
  return `\n\nMit freundlichen Gruessen\n${v.vereinsname}\n${v.email}`;
}

/** Eingangsbestaetigung eines Beitrittsantrags. */
export function mailAntragEingang(v: VereinKopf, name: string): { betreff: string; text: string } {
  return {
    betreff: `Ihr Beitrittsantrag bei der ${v.vereinsname}`,
    text:
      `Hallo ${name},\n\n` +
      `vielen Dank fuer Ihren Beitrittsantrag. Er ist bei uns eingegangen und wird ` +
      `vom Vorstand geprueft. Bei ausgeschoepfter Kapazitaet setzen wir Sie auf die ` +
      `Warteliste und melden uns, sobald ein Platz frei wird.\n\n` +
      `Diese E-Mail wurde automatisch versendet.` +
      fuss(v),
  };
}

/** Aufnahme: Zugangsdaten fuer den Mitgliederbereich. */
export function mailAufnahme(
  v: VereinKopf,
  name: string,
  mitgliedsnummer: string,
  email: string,
  startpasswort: string,
): { betreff: string; text: string } {
  return {
    betreff: `Willkommen in der ${v.vereinsname} - Ihre Zugangsdaten`,
    text:
      `Hallo ${name},\n\n` +
      `Sie wurden als Mitglied aufgenommen. Herzlich willkommen!\n\n` +
      `Ihre Mitgliedsnummer: ${mitgliedsnummer}\n\n` +
      `Zugang zum Mitgliederbereich:\n` +
      `  E-Mail:    ${email}\n` +
      `  Passwort:  ${startpasswort}\n\n` +
      `Bitte aendern Sie das Passwort nach der ersten Anmeldung und richten Sie ` +
      `im Bereich "Sicherheit" die Zwei-Faktor-Anmeldung ein.` +
      fuss(v),
  };
}

/** Ablehnung eines Antrags (sachlich). */
export function mailAblehnung(v: VereinKopf, name: string): { betreff: string; text: string } {
  return {
    betreff: `Ihr Beitrittsantrag bei der ${v.vereinsname}`,
    text:
      `Hallo ${name},\n\n` +
      `vielen Dank fuer Ihr Interesse. Wir koennen Ihren Aufnahmeantrag derzeit ` +
      `leider nicht beruecksichtigen.\n\n` +
      `Bei Rueckfragen erreichen Sie uns unter ${v.email}.` +
      fuss(v),
  };
}

/** Testmail (Vorstand prueft die SMTP-Konfiguration). */
export function mailTest(v: VereinKopf): { betreff: string; text: string } {
  return {
    betreff: `Testnachricht der ${v.vereinsname}`,
    text: `Dies ist eine Testnachricht. Wenn Sie sie erhalten, ist der E-Mail-Versand korrekt eingerichtet.` + fuss(v),
  };
}

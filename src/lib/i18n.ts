// Mehrsprachigkeit der Mitglieder-Kernseiten: Deutsch (Standard), Englisch,
// Polnisch. Bewusst ein einfaches Wörterbuch (kein Framework): jede Zeile ist
// [de, en, pl]. Übersetzt wird die Oberfläche (Navigation, Login, §23-Hinweise,
// Ausweis, Mein Konto, Schwarzes Brett) — von Mitgliedern/Vorstand eingetragene
// Inhalte bleiben in ihrer Originalsprache. Sprachwahl liegt im Cookie
// `sprache` und wird pro Anfrage in locals.sprache gereicht.

export const SPRACHEN = ['de', 'en', 'pl'] as const;
export type Sprache = (typeof SPRACHEN)[number];
export const SPRACHE_COOKIE = 'sprache';
export const SPRACHE_LABEL: Record<Sprache, string> = { de: 'Deutsch', en: 'English', pl: 'Polski' };

export function spracheAus(wert?: string): Sprache {
  return (SPRACHEN as readonly string[]).includes(wert ?? '') ? (wert as Sprache) : 'de';
}

// [de, en, pl]
const W: Record<string, [string, string, string]> = {
  // --- Navigation (Mitglieder) ---
  'nav.aktuelles': ['Aktuelles', 'News', 'Aktualności'],
  'nav.angebot': ['Angebot der Woche', 'Weekly offer', 'Oferta tygodnia'],
  'nav.vorbestellung': ['Vorbestellung', 'Pre-order', 'Rezerwacja'],
  'nav.termine': ['Termine', 'Events', 'Terminy'],
  'nav.helferplan': ['Helferplan', 'Volunteer plan', 'Plan dyżurów'],
  'nav.abstimmungen': ['Abstimmungen', 'Votes', 'Głosowania'],
  'nav.brett': ['Schwarzes Brett', 'Notice board', 'Tablica ogłoszeń'],
  'nav.wissen': ['Wissen', 'Knowledge', 'Wiedza'],
  'nav.ausweis': ['Ausweis', 'ID card', 'Legitymacja'],
  'nav.konto': ['Mein Konto', 'My account', 'Moje konto'],
  'nav.app': ['App', 'App', 'Aplikacja'],
  'nav.sicherheit': ['Sicherheit', 'Security', 'Bezpieczeństwo'],
  'nav.abmelden': ['Abmelden', 'Sign out', 'Wyloguj'],
  'nav.bereich': ['Mitgliederbereich', 'Members area', 'Strefa członków'],

  // --- Login ---
  'login.titel': ['Anmeldung', 'Sign in', 'Logowanie'],
  'login.intro': [
    'Dieser Bereich ist Mitgliedern vorbehalten. Bitte melden Sie sich mit Ihren Zugangsdaten an.',
    'This area is reserved for members. Please sign in with your credentials.',
    'Ta strefa jest zarezerwowana dla członków. Zaloguj się swoimi danymi dostępowymi.',
  ],
  'login.email': ['E-Mail-Adresse', 'Email address', 'Adres e-mail'],
  'login.passwort': ['Passwort', 'Password', 'Hasło'],
  'login.knopf': ['Anmelden', 'Sign in', 'Zaloguj się'],
  'login.abgemeldet': ['Sie wurden abgemeldet.', 'You have been signed out.', 'Wylogowano.'],
  'login.fehler.fehlend': [
    'Bitte E-Mail-Adresse und Passwort eingeben.',
    'Please enter your email address and password.',
    'Podaj adres e-mail i hasło.',
  ],
  'login.fehler.ungueltig': [
    'Anmeldung nicht möglich. Bitte prüfen Sie Ihre Zugangsdaten.',
    'Sign-in failed. Please check your credentials.',
    'Logowanie nie powiodło się. Sprawdź swoje dane.',
  ],
  'login.fehler.anmeldung': [
    'Bitte melden Sie sich an, um den Mitgliederbereich zu sehen.',
    'Please sign in to view the members area.',
    'Zaloguj się, aby zobaczyć strefę członków.',
  ],

  // --- §23-Hinweise (Einwilligung) ---
  'hinweise.eyebrow': ['Vor der ersten Nutzung', 'Before first use', 'Przed pierwszym użyciem'],
  'hinweise.titel': [
    'Präventions- und Gesundheitshinweise',
    'Prevention and health information',
    'Informacje o profilaktyce i zdrowiu',
  ],
  'hinweise.intro': [
    'Bitte lies die folgenden Hinweise nach § 23 Konsumcannabisgesetz aufmerksam und bestätige die Kenntnisnahme. Erst danach steht dir der Mitgliederbereich offen.',
    'Please read the following information required by Section 23 of the German Cannabis Act (KCanG) carefully and confirm that you have taken note of it. Only then will the members area be available to you.',
    'Przeczytaj uważnie poniższe informacje wymagane przez § 23 niemieckiej ustawy o konopiach (KCanG) i potwierdź zapoznanie się z nimi. Dopiero potem strefa członków będzie dostępna.',
  ],
  'hinweise.fehler': [
    'Bitte setze das Häkchen zur Bestätigung.',
    'Please tick the confirmation box.',
    'Zaznacz pole potwierdzenia.',
  ],
  'hinweise.h.gesundheit': ['Gesundheit & Jugendschutz', 'Health & youth protection', 'Zdrowie i ochrona młodzieży'],
  'hinweise.p1': [
    'Der Konsum von Cannabis kann die Gesundheit beeinträchtigen, insbesondere bei jungen Menschen, in der Schwangerschaft und Stillzeit.',
    'Cannabis use can harm your health, especially for young people and during pregnancy and breastfeeding.',
    'Używanie konopi może szkodzić zdrowiu, szczególnie u osób młodych oraz w czasie ciąży i karmienia piersią.',
  ],
  'hinweise.p2': [
    'Konsum vor dem 18. Lebensjahr ist verboten. Für unter 21-Jährige gelten strengere THC-Grenzen bei der Abgabe.',
    'Consumption under the age of 18 is prohibited. Stricter THC limits apply to dispensing for members under 21.',
    'Spożywanie przed 18. rokiem życia jest zabronione. Dla osób poniżej 21 lat obowiązują ostrzejsze limity THC przy wydawaniu.',
  ],
  'hinweise.p3': [
    'Bewahre Cannabis unzugänglich für Kinder und Jugendliche auf.',
    'Store cannabis out of reach of children and young people.',
    'Przechowuj konopie w miejscu niedostępnym dla dzieci i młodzieży.',
  ],
  'hinweise.p4': [
    'Kein Konsum vor dem Führen von Fahrzeugen oder dem Bedienen von Maschinen.',
    'Do not consume before driving vehicles or operating machinery.',
    'Nie spożywaj przed prowadzeniem pojazdów lub obsługą maszyn.',
  ],
  'hinweise.p5': [
    'Mischkonsum mit Alkohol oder anderen Substanzen erhöht die Risiken erheblich.',
    'Mixing with alcohol or other substances significantly increases the risks.',
    'Łączenie z alkoholem lub innymi substancjami znacznie zwiększa ryzyko.',
  ],
  'hinweise.h.umgang': ['Verantwortungsvoller Umgang', 'Responsible use', 'Odpowiedzialne używanie'],
  'hinweise.p6': [
    'Die Abgabe erfolgt ausschließlich an Mitglieder zum Eigenkonsum. Eine Weitergabe an Dritte ist verboten.',
    'Dispensing is exclusively to members for personal use. Passing on to third parties is prohibited.',
    'Wydawanie odbywa się wyłącznie członkom na użytek własny. Przekazywanie osobom trzecim jest zabronione.',
  ],
  'hinweise.p7a': [
    'Bei Fragen, Sorgen oder Anzeichen eines problematischen Konsums wende dich an unsere Präventionsperson:',
    'If you have questions, concerns or signs of problematic use, contact our prevention officer:',
    'W razie pytań, obaw lub oznak problemowego używania skontaktuj się z naszą osobą ds. profilaktyki:',
  ],
  'hinweise.p8a': ['Weitere Beratung und Hilfe findest du unter', 'Further advice and help:', 'Dalsze porady i pomoc:'],
  'hinweise.p8link': ['Prävention und Beratung', 'Prevention and counselling', 'Profilaktyka i poradnictwo'],
  'hinweise.check': [
    'Ich habe die Präventions- und Gesundheitshinweise gelesen und zur Kenntnis genommen.',
    'I have read and taken note of the prevention and health information.',
    'Przeczytałem/-am informacje o profilaktyce i zdrowiu i przyjmuję je do wiadomości.',
  ],
  'hinweise.knopf': ['Bestätigen & fortfahren', 'Confirm & continue', 'Potwierdź i kontynuuj'],
  'hinweise.fuss': [
    'Deine Bestätigung wird mit Zeitstempel dokumentiert.',
    'Your confirmation is recorded with a timestamp.',
    'Twoje potwierdzenie zostanie zapisane ze znacznikiem czasu.',
  ],
  'hinweise.version': ['Version', 'Version', 'Wersja'],

  // --- Ausweis ---
  'ausweis.titel': ['Mitgliedsausweis', 'Membership card', 'Legitymacja członkowska'],
  'ausweis.intro': [
    'Zeig diesen Ausweis am Tresen — der QR-Code wird gescannt und du bist sofort ausgewählt. Ein Bildschirmfoto auf dem Handy reicht.',
    'Show this card at the counter — the QR code is scanned and you are selected instantly. A screenshot on your phone is enough.',
    'Pokaż tę legitymację przy ladzie — kod QR zostanie zeskanowany i od razu zostaniesz wybrany. Wystarczy zrzut ekranu na telefonie.',
  ],
  'ausweis.keine_nummer': [
    'Für dein Konto ist noch keine Mitgliedsnummer hinterlegt — bitte beim Vorstand melden.',
    'No membership number is stored for your account yet — please contact the board.',
    'Do Twojego konta nie przypisano jeszcze numeru członkowskiego — skontaktuj się z zarządem.',
  ],
  'ausweis.fuss': ['Mitgliedsausweis · nicht übertragbar', 'Membership card · not transferable', 'Legitymacja członkowska · nieprzenoszalna'],
  'ausweis.lichtbild': [
    'Nur zusammen mit einem gültigen amtlichen Lichtbildausweis gültig.',
    'Only valid together with a valid official photo ID.',
    'Ważna tylko wraz z ważnym urzędowym dokumentem tożsamości ze zdjęciem.',
  ],

  // --- Mein Konto ---
  'profil.titel': ['Mein Konto', 'My account', 'Moje konto'],
  'profil.intro.mit_sepa': [
    'Hier pflegst du deine Kontaktdaten und dein SEPA-Lastschriftmandat selbst. Name, Mitgliedsnummer und Stammdaten verwaltet der Vorstand — melde dich bei Änderungen dort.',
    'Here you manage your contact details and your SEPA direct-debit mandate yourself. Name, membership number and master data are managed by the board — contact them for changes.',
    'Tutaj samodzielnie zarządzasz swoimi danymi kontaktowymi i upoważnieniem SEPA. Imię i nazwisko, numer członkowski i dane podstawowe prowadzi zarząd — w sprawie zmian zgłoś się do niego.',
  ],
  'profil.intro.ohne_sepa': [
    'Hier pflegst du deine Kontaktdaten selbst. Name, Mitgliedsnummer und Stammdaten verwaltet der Vorstand — melde dich bei Änderungen dort.',
    'Here you manage your contact details yourself. Name, membership number and master data are managed by the board — contact them for changes.',
    'Tutaj samodzielnie zarządzasz swoimi danymi kontaktowymi. Imię i nazwisko, numer członkowski i dane podstawowe prowadzi zarząd — w sprawie zmian zgłoś się do niego.',
  ],
  'profil.gespeichert': ['Gespeichert. Danke!', 'Saved. Thank you!', 'Zapisano. Dziękujemy!'],
  'profil.fehler': ['Das hat nicht geklappt. Bitte erneut versuchen.', 'That did not work. Please try again.', 'Nie udało się. Spróbuj ponownie.'],
  'profil.meine_daten': ['Meine Daten', 'My details', 'Moje dane'],
  'profil.nummer': ['Mitgliedsnummer', 'Membership number', 'Numer członkowski'],
  'profil.name': ['Name', 'Name', 'Imię i nazwisko'],
  'profil.geburtsdatum': ['Geburtsdatum', 'Date of birth', 'Data urodzenia'],
  'profil.email_login': ['E-Mail (Login)', 'Email (login)', 'E-mail (login)'],
  'profil.nur_vorstand': ['Diese Angaben ändert nur der Vorstand.', 'Only the board can change these details.', 'Te dane może zmienić tylko zarząd.'],
  'profil.kontakt': ['Kontakt', 'Contact', 'Kontakt'],
  'profil.telefon': ['Telefon', 'Phone', 'Telefon'],
  'profil.speichern': ['Speichern', 'Save', 'Zapisz'],
  'profil.sprache': ['Sprache', 'Language', 'Język'],

  // --- Schwarzes Brett ---
  'brett.titel': ['Schwarzes Brett', 'Notice board', 'Tablica ogłoszeń'],
  'brett.intro': [
    'Für Fragen, Angebote und den Austausch unter Mitgliedern. Bitte sachlich bleiben — Beiträge sind für alle Mitglieder sichtbar. Eigene Beiträge kannst du löschen.',
    'For questions, offers and exchange among members. Please keep it factual — posts are visible to all members. You can delete your own posts.',
    'Do pytań, ogłoszeń i wymiany między członkami. Zachowaj rzeczowość — wpisy są widoczne dla wszystkich członków. Własne wpisy możesz usunąć.',
  ],
  'brett.platzhalter': ['Was möchtest du mit dem Verein teilen?', 'What would you like to share with the club?', 'Czym chcesz się podzielić z klubem?'],
  'brett.veroeffentlichen': ['Veröffentlichen', 'Publish', 'Opublikuj'],
  'brett.leer': ['Noch keine Beiträge — schreib den ersten!', 'No posts yet — write the first one!', 'Brak wpisów — napisz pierwszy!'],
  'brett.antworten': ['Antworten', 'Reply', 'Odpowiedz'],
  'brett.antwort_platzhalter': ['Deine Antwort…', 'Your reply…', 'Twoja odpowiedź…'],
  'brett.geloescht': ['Beitrag gelöscht.', 'Post deleted.', 'Wpis usunięty.'],
  'brett.veroeffentlicht': ['Beitrag veröffentlicht.', 'Post published.', 'Wpis opublikowany.'],
  'brett.loeschen': ['Beitrag löschen', 'Delete post', 'Usuń wpis'],
};

/** Liefert eine Übersetzungsfunktion für die gewählte Sprache (Fallback de). */
export function uebersetzer(sprache: Sprache): (key: string) => string {
  const i = SPRACHEN.indexOf(sprache);
  return (key: string) => W[key]?.[i] ?? W[key]?.[0] ?? key;
}

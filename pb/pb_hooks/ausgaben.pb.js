// T6 (SPEC-AUSGABE.md, fixt F2, haertet F4): autoritative KCanG-Grenze in der
// Datenbankschicht. Der Astro-Endpoint (src/pages/mitglieder/ausgabe/buchen.ts)
// prueft korrekt, ABER die PocketBase-API selbst pruefte bisher nur die Rolle
// (createRule) - wer einen "ausgabe"-Token hat, konnte per direktem
// PB-API-Create Limits/Datum/THC am Endpoint vorbei umgehen. Dieser Hook
// schliesst diese Luecke: er greift bei JEDEM Create auf "ausgaben", egal ob
// ueber den Astro-Endpoint oder direkt ueber die PB-API.
//
// WICHTIG: Die Grenzwerte unten MUESSEN src/lib/ausgabe.ts spiegeln - bei
// einer Aenderung dort (25/50/30/10) auch hier nachziehen.
//
// Hinweis Implementierung: alle Hilfsfunktionen sind ABSICHTLICH innerhalb
// des Hook-Callbacks verschachtelt (statt Datei-Top-Level). Das PB-JSVM
// (goja/esbuild-Bundling) hat sich hier so verhalten, dass Top-Level-
// `function`-Deklarationen zur Laufzeit des Callbacks nicht mehr aufloesbar
// waren ("ReferenceError: ... is not defined") - Top-Level-`const`-Primitive
// (Grenzwerte) waren dagegen unproblematisch. Lokale Deklarationen sind die
// robuste Variante.
onRecordCreateRequest((e) => {
  const LIMIT_TAG_G = 25;
  const LIMIT_MONAT_G = 50;
  const LIMIT_MONAT_U21_G = 30;
  const U21_MAX_THC = 10;
  const U21_GRENZE = 21;

  // Superuser (Seeds/Tests/Admin-Reparaturen) unveraendert durchlassen.
  if (e.hasSuperuserAuth()) {
    e.next();
    return;
  }

  // -- Berlin-Kalendertag ohne Intl (JSVM/goja hat keine garantierte
  // Zeitzonendatenbank). EU-Sommerzeitregel: MESZ (UTC+2) von letztem
  // Sonntag Maerz 01:00 UTC bis letztem Sonntag Oktober 01:00 UTC, sonst
  // MEZ (UTC+1).
  function letzterSonntagUTC(jahr, monatIndex0) {
    // Tag 0 des Folgemonats == letzter Tag des Zielmonats.
    const d = new Date(Date.UTC(jahr, monatIndex0 + 1, 0));
    const wochentag = d.getUTCDay(); // 0 = Sonntag
    d.setUTCDate(d.getUTCDate() - wochentag);
    return d;
  }

  function berlinOffsetStunden(nowUtc) {
    const jahr = nowUtc.getUTCFullYear();
    const start = letzterSonntagUTC(jahr, 2); // letzter Sonntag Maerz
    start.setUTCHours(1, 0, 0, 0);
    const ende = letzterSonntagUTC(jahr, 9); // letzter Sonntag Oktober
    ende.setUTCHours(1, 0, 0, 0);
    return nowUtc >= start && nowUtc < ende ? 2 : 1;
  }

  function berlinTagJetzt() {
    const jetzt = new Date();
    const offset = berlinOffsetStunden(jetzt);
    const lokal = new Date(jetzt.getTime() + offset * 3600 * 1000);
    const jj = lokal.getUTCFullYear();
    const mm = String(lokal.getUTCMonth() + 1).padStart(2, '0');
    const tt = String(lokal.getUTCDate()).padStart(2, '0');
    return `${jj}-${mm}-${tt}`;
  }

  function berlinMonatVon(tag) {
    return tag.slice(0, 7);
  }

  // Alter in vollen Jahren an einem Stichtag (beide 'YYYY-MM-DD'). null wenn unparsbar.
  function alterAmTag(geburtsdatum, tag) {
    const g = /^(\d{4})-(\d{2})-(\d{2})/.exec(geburtsdatum || '');
    const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(tag || '');
    if (!g || !t) return null;
    const gj = Number(g[1]);
    const gm = Number(g[2]);
    const gt = Number(g[3]);
    const tj = Number(t[1]);
    const tm = Number(t[2]);
    const tt = Number(t[3]);
    let alter = tj - gj;
    if (tm < gm || (tm === gm && tt < gt)) alter--;
    return alter;
  }

  // Fehlendes/unparsbares Geburtsdatum -> strengste Regel (U21), spiegelt src/lib/ausgabe.ts.
  function istU21(geburtsdatum, tag) {
    const alter = alterAmTag(geburtsdatum, tag);
    if (alter === null) return true;
    return alter < U21_GRENZE;
  }

  // tag/monat serverseitig erzwingen (Berlin-Kalendertag) - kein Client kann
  // ein falsches Datum einliefern (z. B. Vormonat, um Limits zu umgehen).
  const tag = berlinTagJetzt();
  const monat = berlinMonatVon(tag);
  e.record.set('tag', tag);
  e.record.set('monat', monat);

  const menge = Number(e.record.get('menge_gramm'));
  if (!(menge > 0)) {
    throw new BadRequestError('Bitte eine gueltige Menge in Gramm angeben.');
  }

  const mitgliedId = e.record.get('mitglied');
  if (!mitgliedId) {
    throw new BadRequestError('Mitglied fehlt.');
  }

  let mitglied;
  try {
    mitglied = $app.findRecordById('users', mitgliedId);
  } catch (err) {
    throw new BadRequestError('Mitglied nicht gefunden.');
  }

  const geburtsdatum = mitglied.get('geburtsdatum');
  const u21 = istU21(geburtsdatum, tag);

  // THC-Regel U21: das Snapshot-Feld des Requests ist die zu pruefende
  // Wahrheit (der Astro-Endpoint befuellt es aus der Charge). Muss > 0 und
  // <= U21_MAX_THC sein, sonst Ablehnung ("unbekannt" gilt als zu hoch -
  // konservativ, siehe src/lib/ausgabe.ts).
  const thcProzent = Number(e.record.get('thc_prozent'));
  if (u21 && (!(thcProzent > 0) || thcProzent > U21_MAX_THC)) {
    throw new BadRequestError(
      `Mitglied unter 21: nur Sorten mit hoechstens ${U21_MAX_THC} % THC zulaessig (THC-Gehalt unbekannt oder zu hoch).`,
    );
  }

  // Summen (Monat/Tag) fuer dieses Mitglied, unstornierte Saetze.
  const bisherige = $app.findRecordsByFilter(
    'ausgaben',
    'mitglied = {:m} && monat = {:mo} && storniert != true',
    '',
    0,
    0,
    { m: mitgliedId, mo: monat },
  );
  let mengeMonatBisher = 0;
  let mengeHeuteBisher = 0;
  for (const r of bisherige) {
    const g = Number(r.get('menge_gramm')) || 0;
    mengeMonatBisher += g;
    if (r.get('tag') === tag) mengeHeuteBisher += g;
  }

  const monatslimit = u21 ? LIMIT_MONAT_U21_G : LIMIT_MONAT_G;

  if (mengeHeuteBisher + menge > LIMIT_TAG_G) {
    throw new BadRequestError(`Tageslimit ${LIMIT_TAG_G} g ueberschritten - heute noch ${Math.max(0, LIMIT_TAG_G - mengeHeuteBisher)} g moeglich.`);
  }
  if (mengeMonatBisher + menge > monatslimit) {
    throw new BadRequestError(`Monatslimit ${monatslimit} g ueberschritten - diesen Monat noch ${Math.max(0, monatslimit - mengeMonatBisher)} g moeglich.`);
  }

  e.next();
}, 'ausgaben');

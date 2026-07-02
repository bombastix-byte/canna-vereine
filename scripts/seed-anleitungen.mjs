// Richtet die Verfahrensbibliothek ein (idempotent):
//  - Collection `anleitungen` (SOPs: Schritte, Hinweise, benoetigte Rolle)
//  - helferdienste um `anleitung` (Relation) + `benoetigte_rolle` erweitert
//  - Demo-Anleitungen + Verknuepfung mit den Demo-Diensten
// Lesen duerfen alle Mitglieder (Transparenz: "so wird es gemacht");
// pflegen darf der Vorstand (im CMS oder spaeter per UI).
import PocketBase from 'pocketbase';
import { REGEL } from '../src/lib/rollen.ts';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

async function ensureCollection(def) {
  try {
    await pb.collections.getOne(def.name);
    console.log('Collection vorhanden:', def.name);
  } catch {
    await pb.collections.create(def);
    console.log('Collection angelegt:', def.name);
  }
}

async function ensureFeld(collection, feld) {
  const col = await pb.collections.getOne(collection);
  if ((col.fields ?? []).some((f) => f.name === feld.name)) return;
  await pb.collections.update(collection, { fields: [...col.fields, feld] });
  console.log(`${collection}: Feld ${feld.name} ergaenzt.`);
}

await ensureCollection({
  name: 'anleitungen',
  type: 'base',
  listRule: REGEL.angemeldet,
  viewRule: REGEL.angemeldet,
  createRule: REGEL.vorstand,
  updateRule: REGEL.vorstand,
  deleteRule: null,
  fields: [
    { name: 'titel', type: 'text', required: true },
    { name: 'kategorie', type: 'select', maxSelect: 1, values: ['anbau', 'ernte', 'lager', 'ausgabe', 'allgemein'] },
    { name: 'zweck', type: 'text' }, // 1-2 Saetze: wofuer ist das Verfahren da
    { name: 'schritte', type: 'text', required: true }, // eine Zeile = ein Schritt
    { name: 'hinweise', type: 'text' }, // Sicherheit / haeufige Fehler
    { name: 'benoetigte_rolle', type: 'select', maxSelect: 1, values: ['anbau', 'ausgabe', 'vorstand'] }, // leer = jedes Mitglied
    { name: 'aktiv', type: 'bool' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
});

const anleitungenId = (await pb.collections.getOne('anleitungen')).id;
await ensureFeld('helferdienste', {
  name: 'anleitung',
  type: 'relation',
  maxSelect: 1,
  collectionId: anleitungenId,
  cascadeDelete: false,
});
await ensureFeld('helferdienste', {
  name: 'benoetigte_rolle',
  type: 'select',
  maxSelect: 1,
  values: ['anbau', 'ausgabe', 'vorstand'],
});

// ---------- Demo-Anleitungen ----------
async function ensureAnleitung(a) {
  try {
    const alt = await pb.collection('anleitungen').getFirstListItem(`titel="${a.titel}"`);
    return alt;
  } catch {
    const neu = await pb.collection('anleitungen').create({ ...a, aktiv: true });
    console.log('Anleitung angelegt:', a.titel);
    return neu;
  }
}

const giessen = await ensureAnleitung({
  titel: 'Gießen',
  kategorie: 'anbau',
  zweck: 'Pflanzen gleichmäßig mit Wasser versorgen, ohne Staunässe.',
  schritte: [
    'Gießplan am Whiteboard prüfen: welche Reihe ist heute dran.',
    'Wasser auf Zimmertemperatur verwenden (Kanister stehen bereit).',
    'Fingerprobe: obere 2 cm Erde trocken? Erst dann gießen.',
    'Langsam am Topfrand gießen, bis unten etwas austritt.',
    'Untersetzer nach 15 Minuten leeren (keine Staunässe).',
    'Gießmenge und Datum in die Liste am Regal eintragen.',
  ].join('\n'),
  hinweise: 'Lieber zu trocken als zu nass. Bei gelben Blättern oder Schimmelgeruch: nicht gießen, Anbau-Team informieren.',
});

const kontrolle = await ensureAnleitung({
  titel: 'Kontrolle und Lüften',
  kategorie: 'anbau',
  zweck: 'Klima im Anbauraum prüfen und Frischluft sicherstellen.',
  schritte: [
    'Thermometer/Hygrometer ablesen (Soll: 20-26 °C, 40-60 % Luftfeuchte).',
    'Werte in die Klimaliste eintragen.',
    'Fenster/Abluft 10 Minuten öffnen bzw. laufen lassen.',
    'Sichtkontrolle: Blattunterseiten auf Schädlinge prüfen.',
    'Auffälligkeiten mit Foto an das Anbau-Team melden.',
  ].join('\n'),
  hinweise: 'Nie die Tür offen stehen lassen (Geruch, Zutritt). Auffällige Pflanzen NICHT selbst entfernen.',
});

const ernte = await ensureAnleitung({
  titel: 'Ernte durchführen und Frischgewicht wiegen',
  kategorie: 'ernte',
  zweck: 'Charge sauber ernten und das Frischgewicht für die Dokumentation erfassen.',
  schritte: [
    'Handschuhe anziehen, Schneidwerkzeug desinfizieren.',
    'Nur die im System angesagte Charge ernten (Chargen-Nr. an der Kiste prüfen).',
    'Pflanzen ganz schneiden und in die beschriftete Ernte-Kiste legen.',
    'Kiste komplett wiegen, Leergewicht der Kiste abziehen.',
    'Frischgewicht sofort in der Warenwirtschaft unter der Charge eintragen (Aktion "Ernte erfassen").',
    'Etikett mit Chargen-Nr. und Datum auf die Kiste.',
  ].join('\n'),
  hinweise: 'Frischgewicht IMMER am selben Tag eintragen - die Mengenbilanz der Vereinigung haengt daran. Nur Anbau-Team.',
  benoetigte_rolle: 'anbau',
});

const wiegen = await ensureAnleitung({
  titel: 'Bestand wiegen und kontrollieren',
  kategorie: 'lager',
  zweck: 'Regelmäßige Bestandskontrolle: Ist-Gewicht je Charge gegen das System prüfen.',
  schritte: [
    'Nur zu zweit durchführen (Vier-Augen-Prinzip).',
    'Waage mit Prüfgewicht kontrollieren.',
    'Je Charge: Behälter wiegen, Leergewicht abziehen, Ist-Gramm notieren.',
    'Ist-Wert mit "verfügbar" in der Warenwirtschaft vergleichen.',
    'Abweichung über 2 g: sofort Vorstand informieren, nichts selbst korrigieren.',
    'Kontrolle mit Datum und beiden Namen im Protokollbuch quittieren.',
  ].join('\n'),
  hinweise: 'Zugriff auf den Lagerschrank nur Anbau-Team/Vorstand. Abweichungen sind meldepflichtig - nie stillschweigend anpassen.',
  benoetigte_rolle: 'anbau',
});

await ensureAnleitung({
  titel: 'Ausgabe am Tresen',
  kategorie: 'ausgabe',
  zweck: 'Abgabe an Mitglieder korrekt buchen - die gesetzlichen Grenzen prüft das System.',
  schritte: [
    'Im Mitgliederbereich anmelden und "Ausgabe (Tresen)" öffnen.',
    'Mitglied wählen und die Statuskarte lesen (was darf es heute noch).',
    'Sorten und Mengen eintragen - mehrere Sorten in einem Vorgang buchen.',
    '"Alles buchen" klicken, Beleg drucken und der Tüte beilegen.',
    'Gesamtbeitrag an der JTL-Kasse kassieren.',
    'Ausweis nur bei Unsicherheit über die Identität verlangen.',
  ].join('\n'),
  hinweise: 'NIE am System vorbei abgeben - auch nicht "auf später". Blockt das System, ist die Abgabe gesetzlich nicht erlaubt.',
  benoetigte_rolle: 'ausgabe',
});

// ---------- Dienste verknuepfen ----------
async function verknuepfe(dienstTitel, patch) {
  try {
    const d = await pb.collection('helferdienste').getFirstListItem(`titel="${dienstTitel}"`);
    await pb.collection('helferdienste').update(d.id, patch);
    console.log('Dienst verknuepft:', dienstTitel);
  } catch {
    console.log('Dienst nicht gefunden (uebersprungen):', dienstTitel);
  }
}
await verknuepfe('Gießen', { anleitung: giessen.id });
await verknuepfe('Kontrolle und Lüften', { anleitung: kontrolle.id });
await verknuepfe('Beschneiden und Pflege', { benoetigte_rolle: 'anbau' });
await verknuepfe('Arbeitseinsatz: Ernte vorbereiten', { anleitung: ernte.id });

console.log('\nFertig. Verfahrensbibliothek eingerichtet.');

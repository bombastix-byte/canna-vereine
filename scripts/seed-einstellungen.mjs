// Laufzeit-Einstellungen des Vereins: ein einzelner Datensatz mit den
// abschaltbaren Modulen (JSON) und dem Aufnahmebeitrag. Erlaubt das Umschalten
// der Module direkt im Admin, ohne neuen Build. Öffentlich lesbar (die Flags
// sind nicht geheim und werden für die Navigation gebraucht); Schreiben nur
// Vorstand. Idempotent.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const vorstand = '@request.auth.rollen ~ "vorstand"';

try {
  await pb.collections.getOne('einstellungen');
  console.log('einstellungen: vorhanden.');
} catch {
  await pb.collections.create({
    name: 'einstellungen',
    type: 'base',
    listRule: '', // öffentlich lesbar (nur Modul-Flags + Aufnahmebeitrag)
    viewRule: '',
    createRule: vorstand,
    updateRule: vorstand,
    deleteRule: null,
    fields: [
      // Nur die ausdrücklich gesetzten Schlüssel überschreiben die Config-Defaults.
      { name: 'funktionen', type: 'json', maxSize: 20000 },
      { name: 'aufnahmebeitrag_euro', type: 'number' },
      { name: 'aktualisiert_am', type: 'text' },
      { name: 'aktualisiert_von', type: 'text' },
    ],
  });
  console.log('einstellungen: angelegt.');
}

// Einzelnen Datensatz sicherstellen (leer = alles nach Config-Default).
const vorhanden = await pb.collection('einstellungen').getFullList();
if (vorhanden.length === 0) {
  await pb.collection('einstellungen').create({ funktionen: {}, aufnahmebeitrag_euro: null });
  console.log('einstellungen: Startdatensatz angelegt.');
} else {
  console.log(`einstellungen: ${vorhanden.length} Datensatz vorhanden.`);
}

console.log('Fertig.');

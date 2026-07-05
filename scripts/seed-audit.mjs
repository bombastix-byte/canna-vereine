// Änderungshistorie / Audit-Log: append-only Protokoll sicherheits- und
// governance-relevanter Aktionen (Mitgliedsdaten, Rollen, Freigaben, Storno,
// Zahlungen, Rückrufe). Idempotent.
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

const usersId = (await pb.collections.getOne('users')).id;

// Lesen nur Vorstand; Anlegen jedes Personal (die Endpoints schreiben mit dem
// Akteur-Client). Kein Update/Delete -> manipulationssicher.
const personal = '@request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "anbau" || @request.auth.rollen ~ "vorstand"';
const vorstand = '@request.auth.rollen ~ "vorstand"';

let col;
try {
  col = await pb.collections.getOne('audit_log');
  console.log('audit_log: vorhanden.');
} catch {
  col = await pb.collections.create({
    name: 'audit_log',
    type: 'base',
    listRule: vorstand,
    viewRule: vorstand,
    createRule: personal,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: 'akteur', type: 'relation', maxSelect: 1, collectionId: usersId, cascadeDelete: false },
      { name: 'akteur_name', type: 'text' },
      { name: 'aktion', type: 'text', required: true },
      { name: 'objekt_typ', type: 'text' },
      { name: 'objekt_id', type: 'text' },
      { name: 'objekt_label', type: 'text' },
      { name: 'details', type: 'text' },
    ],
  });
  console.log('audit_log: angelegt.');
}

// Zeitstempel (autodate) sicherstellen — für Sortierung/Anzeige nötig.
if (!(col.fields ?? []).some((f) => f.name === 'created')) {
  await pb.collections.update('audit_log', {
    fields: [...col.fields, { name: 'created', type: 'autodate', onCreate: true, onUpdate: false }],
  });
  console.log('audit_log: Feld created (autodate) ergaenzt.');
} else {
  console.log('audit_log: created vorhanden.');
}

console.log('Fertig.');

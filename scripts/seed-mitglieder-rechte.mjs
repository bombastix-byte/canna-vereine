// Rechte auf users fuer manuelles Anlegen/Entfernen durch den Vorstand:
//  - createRule war offen ("") -> auf Vorstand einschraenken (kein offener Signup)
//  - deleteRule erlaubte nur Selbstloeschung -> Vorstand darf Mitglieder entfernen
// Idempotent.
import PocketBase from 'pocketbase';
import { REGEL } from '../src/lib/rollen.ts';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

await pb.collections.update('users', {
  createRule: REGEL.vorstand,
  deleteRule: REGEL.vorstand,
});
console.log('users: create/delete auf Vorstand gesetzt.');

// Erlaubt dem Anbau-Team/Vorstand, Sorten ueber die Website anzulegen
// (bisher nur per CMS moeglich; Lesen/Aendern war schon geregelt). Idempotent.
import PocketBase from 'pocketbase';
import { REGEL } from '../src/lib/rollen.ts';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);

await pb.collections.update('sorten', { createRule: REGEL.anbau });
console.log('sorten.createRule = Anbau/Vorstand gesetzt. Fertig.');

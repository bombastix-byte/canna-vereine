// Löscht die Collection wochenangebot, damit seed.mjs sie mit dem aktuellen
// Schema (inkl. JSON-Feld sorten) neu anlegt. Reines Migrations-Hilfswerkzeug.
import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.PB_URL ?? 'http://127.0.0.1:8090');
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(
  process.env.PB_ADMIN_EMAIL,
  process.env.PB_ADMIN_PW,
);

try {
  const c = await pb.collections.getOne('wochenangebot');
  await pb.collections.delete(c.id);
  console.log('Collection geloescht: wochenangebot');
} catch {
  console.log('nicht vorhanden: wochenangebot');
}
console.log('Reset wochenangebot fertig.');

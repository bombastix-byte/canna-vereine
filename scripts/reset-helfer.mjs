// Löscht die Helfer-Collections, damit seed.mjs sie mit aktuellem Schema neu
// anlegt (Umstellung auf das Vorlagen-/Rhythmus-Modell). Demo-Eintragungen
// gehen dabei verloren. Reihenfolge: abhängige Collection zuerst.
import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.PB_URL ?? 'http://127.0.0.1:8090');
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(
  process.env.PB_ADMIN_EMAIL,
  process.env.PB_ADMIN_PW,
);

for (const name of ['helfer_eintragungen', 'helferdienste']) {
  try {
    const c = await pb.collections.getOne(name);
    await pb.collections.delete(c.id);
    console.log('Collection geloescht:', name);
  } catch {
    console.log('nicht vorhanden:', name);
  }
}
console.log('Helfer-Reset fertig.');

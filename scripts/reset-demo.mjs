// Einmaliges Leeren der Demo-Inhalts-Collections, damit seed.mjs sie mit
// korrigiertem Text neu befuellt. Laesst users und vorbestellungen unberuehrt.
// Reines Entwicklungs-/Demo-Werkzeug.
import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.PB_URL ?? 'http://127.0.0.1:8090');
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(
  process.env.PB_ADMIN_EMAIL,
  process.env.PB_ADMIN_PW,
);

for (const c of ['mitteilungen', 'termine', 'dokumente', 'wochenangebot', 'sortenberichte']) {
  const items = await pb.collection(c).getFullList();
  for (const it of items) await pb.collection(c).delete(it.id);
  console.log('geleert:', c, items.length);
}
console.log('Reset fertig.');

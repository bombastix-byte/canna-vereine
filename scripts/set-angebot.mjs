// Setzt das aktuelle "Angebot der Woche" (ersetzt vorhandene Eintraege).
// Sorten als strukturierte Liste (Name, Typ, THC, CBD) -> Tabelle auf der Seite.
// Reines Hilfswerkzeug fuer den Vorstand/Betrieb.
import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.PB_URL ?? 'http://127.0.0.1:8090');
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(
  process.env.PB_ADMIN_EMAIL,
  process.env.PB_ADMIN_PW,
);

const alt = await pb.collection('wochenangebot').getFullList();
for (const a of alt) await pb.collection('wochenangebot').delete(a.id);

await pb.collection('wochenangebot').create({
  titel: 'Aktuelle Abgabe diese Woche',
  inhalt:
    'Die Abgabe erfolgt zum Selbstkostenbeitrag im Rahmen der Satzung, ' +
    'Abholung zu den ausgehängten Vereinszeiten. Alle THC- und CBD-Werte ' +
    'stammen aus eigener Messung der Vereinigung.',
  sorten: [
    { name: 'Pineapple Express', typ: 'Sativa', thc: '30,0 %', cbd: '2,0 %' },
    { name: 'Hulk Berry', typ: 'Sativa', thc: '24,0 %', cbd: '2,0 %' },
    { name: 'Fat Bastard', typ: 'Hybrid', thc: '30,0 %', cbd: '2,0 %' },
    { name: 'Orbital Banana', typ: 'Hybrid', thc: '25,0 %', cbd: '2,0 %' },
    { name: 'Gushers', typ: 'Indica', thc: '26,0 %', cbd: '2,0 %' },
    { name: 'Watermelon', typ: 'Indica', thc: '20,0 %', cbd: '2,0 %' },
  ],
  gueltig_von: '2026-06-29 00:00:00.000Z',
  gueltig_bis: '2026-07-05 00:00:00.000Z',
});
console.log('Angebot der Woche gesetzt (6 Sorten, Tabelle).');

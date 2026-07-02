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
    { name: 'Northern Lights', typ: 'Indica', thc: '18,2 %', cbd: '0,6 %' },
    { name: 'Granddaddy Purple', typ: 'Indica', thc: '17,4 %', cbd: '0,5 %' },
    { name: 'Lemon Haze', typ: 'Sativa', thc: '20,1 %', cbd: '0,4 %' },
    { name: 'Amnesia Haze', typ: 'Sativa', thc: '21,8 %', cbd: '0,3 %' },
    { name: 'White Widow', typ: 'Hybrid', thc: '19,0 %', cbd: '1,1 %' },
  ],
  gueltig_von: '2026-06-22 00:00:00.000Z',
  gueltig_bis: '2026-06-28 00:00:00.000Z',
});
console.log('Angebot der Woche gesetzt (5 Sorten, Tabelle).');

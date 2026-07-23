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
  gueltig_von: new Date().toISOString().slice(0, 10) + ' 00:00:00.000Z',
  gueltig_bis: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) + ' 23:59:59.999Z',
});
console.log('Aktuelle Abgabe gesetzt (6 Sorten, Tabelle).');

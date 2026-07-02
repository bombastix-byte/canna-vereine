// Einmaliges Anlegen einer Mitteilung (Ankuendigung) als Admin.
// Inhalt unten anpassen. Reines Hilfswerkzeug fuer den Vorstand/Betrieb.
import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.PB_URL ?? 'http://127.0.0.1:8090');
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(
  process.env.PB_ADMIN_EMAIL,
  process.env.PB_ADMIN_PW,
);

const r = await pb.collection('mitteilungen').create({
  titel: 'Arbeitseinsatz Mitte Juli',
  inhalt:
    'Mitte Juli ist ein gemeinsamer Arbeitseinsatz geplant. Wir freuen uns ' +
    'über die tatkräftige Unterstützung der Mitglieder bei den anstehenden ' +
    'Aufgaben rund um den gemeinschaftlichen Anbau. Der genaue Termin und die ' +
    'Aufgaben werden rechtzeitig hier und im Terminbereich bekannt gegeben.',
  datum: '2026-06-25 09:00:00.000Z',
});
console.log('Mitteilung angelegt:', r.titel);

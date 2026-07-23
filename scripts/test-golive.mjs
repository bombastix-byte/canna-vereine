import { goliveBlocker } from '../src/lib/golive.ts';

const basis = {
  id: 'test', theme: 'klar', vereinsname: 'Test e. V.', kurzname: 'Test', stadt: 'Test',
  kontakt: { strasse: 'Straße 1', plz: '00000', ort: 'Test', email: 'kontakt@test.de' },
  vorstand: [{ name: 'Max Test', rolle: 'Vorsitz' }],
  praeventionsbeauftragter: { name: 'Petra Test', rolle: 'Prävention', email: 'p@test.de' },
  externeBeratung: [], dokumente: {},
  impressum: { vertretungsberechtigt: 'Max Test', inhaltlichVerantwortlich: 'Max Test' },
};

let fehler = 0;
function pruefe(name, bedingung) {
  if (!bedingung) fehler++;
  console.log(`${bedingung ? 'PASS' : 'FAIL'}  ${name}`);
}

pruefe('vollstaendige Config ohne Blocker', goliveBlocker(basis, {
  domain: 'cvg.example.org', avvBestaetigt: true, kasseEntschieden: true,
}).length === 0);
pruefe('TODO wird erkannt', goliveBlocker({ ...basis, registereintrag: 'TODO VR' }, {
  domain: 'cvg.example.org', avvBestaetigt: true, kasseEntschieden: true,
}).some((x) => x.includes('registereintrag')));
pruefe('externe Gates werden erkannt', goliveBlocker(basis).length === 3);

if (fehler) process.exit(1);
console.log('\nALLE GO-LIVE-TESTS BESTANDEN');

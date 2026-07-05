// Test der Namensaufteilung fuer den Ausweis. Aufruf: node scripts/test-namen.mjs
import { namensteile } from '../src/lib/namen.ts';

let fehler = 0;
function pruefe(name, ist, soll) {
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ist=${JSON.stringify(ist)} soll=${JSON.stringify(soll)}`}`);
}

pruefe('einfach', namensteile({ name: 'Sebastian Mergl' }), { vorname: 'Sebastian', nachname: 'Mergl' });
pruefe('zwei Vornamen', namensteile({ name: 'Anna Maria Berg' }), { vorname: 'Anna Maria', nachname: 'Berg' });
pruefe('Partikel von', namensteile({ name: 'Peter von Berg' }), { vorname: 'Peter', nachname: 'von Berg' });
pruefe('Partikel van der', namensteile({ name: 'Jan van der Meer' }), { vorname: 'Jan', nachname: 'van der Meer' });
pruefe('nur ein Wort', namensteile({ name: 'Cher' }), { vorname: '', nachname: 'Cher' });
pruefe('explizit hat Vorrang', namensteile({ name: 'Falsch Falsch', vorname: 'Max', nachname: 'Mustermann' }), { vorname: 'Max', nachname: 'Mustermann' });
pruefe('nur explizit Nachname', namensteile({ nachname: 'Schmidt' }), { vorname: '', nachname: 'Schmidt' });
pruefe('leer', namensteile({}), { vorname: '', nachname: '' });

if (fehler > 0) { console.log(`\n${fehler} FEHLGESCHLAGEN`); process.exit(1); }
console.log('\nALLE NAMEN-TESTS BESTANDEN');

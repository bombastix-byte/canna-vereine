// Test der Kassen-Geldrechnung. Aufruf: node scripts/test-kasse.mjs
import { euro, erwarteteEinnahme, differenz } from '../src/lib/kasse.ts';

let fehler = 0;
function pruefe(name, ist, soll) {
  const ok = ist === soll;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ist=${ist} soll=${soll}`}`);
}

pruefe('euro rundet auf Cent', euro(12.345), 12.35);
pruefe('euro von NaN = 0', euro(NaN), 0);
pruefe('erwartet = Beitraege+Einlagen-Entnahmen', erwarteteEinnahme(100, 50, 20), 130);
pruefe('erwartet Cent-genau', erwarteteEinnahme(10.1, 0.2, 0.05), 10.25);
pruefe('Differenz Ueberschuss', differenz(131, 130), 1);
pruefe('Differenz Fehlbetrag', differenz(128.5, 130), -1.5);
pruefe('Differenz null', differenz(130, 130), 0);

if (fehler > 0) { console.log(`\n${fehler} FEHLGESCHLAGEN`); process.exit(1); }
console.log('\nALLE KASSEN-TESTS BESTANDEN');

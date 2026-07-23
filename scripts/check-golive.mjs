import { cvg } from '../src/config/cvg.ts';
import { goerlitz } from '../src/config/goerlitz.ts';
import { goerlitz2 } from '../src/config/goerlitz2.ts';
import { leipzig } from '../src/config/leipzig.ts';
import { goliveBlocker } from '../src/lib/golive.ts';

const args = process.argv.slice(2);
const id = args.find((x) => !x.startsWith('--')) ?? 'cvg';
const sites = { cvg, goerlitz, goerlitz2, leipzig };
const site = sites[id];
if (!site) {
  console.error(`Unbekannte Site: ${id}`);
  process.exit(2);
}
const domain = args.find((x) => x.startsWith('--domain='))?.slice('--domain='.length);
const blocker = goliveBlocker(site, {
  domain,
  avvBestaetigt: args.includes('--avv-bestaetigt'),
  kasseEntschieden: args.includes('--kasse-entschieden'),
});

if (blocker.length) {
  console.error(`GO-LIVE GESPERRT (${blocker.length} Blocker):`);
  for (const b of blocker) console.error(`- ${b}`);
  process.exit(1);
}
console.log(`GO-LIVE-GATE BESTANDEN: ${id} (${domain})`);

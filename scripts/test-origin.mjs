import { originErlaubt } from '../src/lib/origin.ts';

let fehler = 0;
function pruefe(name, ist, soll) {
  const ok = ist === soll;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

const req = (method, origin, extra = {}) => new Request('http://astro:4321/mitglieder/test', {
  method,
  headers: { ...(origin ? { origin } : {}), ...extra },
});

pruefe('GET braucht keinen Origin', originErlaubt(req('GET')), true);
pruefe('POST ohne Origin wird abgelehnt', originErlaubt(req('POST')), false);
pruefe('POST gleiche direkte Origin', originErlaubt(req('POST', 'http://astro:4321')), true);
pruefe('POST via Caddy Forwarded-Header', originErlaubt(req('POST', 'https://cvg.example.de', {
  'x-forwarded-host': 'cvg.example.de',
  'x-forwarded-proto': 'https',
})), true);
pruefe('POST via explizite Allowlist', originErlaubt(req('POST', 'https://app.example.de'), 'https://app.example.de'), true);
pruefe('Fremde Origin wird abgelehnt', originErlaubt(req('POST', 'https://evil.example')), false);
pruefe('Subdomain ist nicht automatisch vertraut', originErlaubt(req('POST', 'https://evil.cvg.example.de'), 'https://cvg.example.de'), false);

if (fehler) process.exit(1);
console.log('\nALLE ORIGIN-TESTS BESTANDEN');

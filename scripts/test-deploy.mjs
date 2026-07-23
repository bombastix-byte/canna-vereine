import { readFileSync } from 'node:fs';

let fehler = 0;
function enthaelt(name, datei, muster) {
  const inhalt = readFileSync(datei, 'utf8');
  const ok = typeof muster === 'string' ? inhalt.includes(muster) : muster.test(inhalt);
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

enthaelt('PocketBase-Image enthaelt KCanG-Hooks', 'deploy/Dockerfile.pocketbase', 'COPY pb/pb_hooks/ /pb/pb_hooks/');
enthaelt('PocketBase-Image enthaelt Cron-Hooks', 'deploy/Dockerfile.pocketbase', 'COPY deploy/pb_hooks/ /pb/pb_hooks/');
enthaelt('CVG-Volume wird gesichert', 'deploy/backup.sh', 'canna_pb_cvg');
enthaelt('Restore-Test kennt CVG-Volume', 'deploy/restore-verify.sh', 'canna_pb_cvg');
enthaelt('Caddy importiert versionierte Site-Snippets', 'deploy/Caddyfile', 'import /etc/caddy/sites/*.caddy');
enthaelt('Caddy routet CVG-PocketBase', 'deploy/sites/cvms.caddy', 'reverse_proxy pb-cvg:8090');
enthaelt('Caddy routet CVG-Astro', 'deploy/sites/cvms.caddy', 'reverse_proxy astro-cvg:4321');
enthaelt('CVG hat Origin-Allowlist', 'deploy/docker-compose.yml', 'TRUSTED_ORIGINS: https://${DOMAIN_CVG}');
enthaelt('PocketBase-Automigration ist deaktiviert', 'deploy/Dockerfile.pocketbase', '--automigrate=false');

if (fehler) process.exit(1);
console.log('\nALLE DEPLOY-TESTS BESTANDEN');

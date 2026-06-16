// Erzeugt einen rein statischen Build NUR der oeffentlichen Seiten, geeignet
// fuer jeden Gratis-Statikhoster. Der serverseitige Mitgliederbereich wird
// fuer diesen Build voruebergehend durch eine schlichte Platzhalter-Seite
// ersetzt. Das echte src/pages/mitglieder bleibt unangetastet (Backup +
// Wiederherstellung in finally).
import { rename, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const mitglieder = join(root, 'src', 'pages', 'mitglieder');
const backup = join(root, 'src', 'pages', '_mitglieder_backup');
const platzhalter = join(root, 'src', 'pages', 'mitglieder.astro');

const PLATZHALTER = `---
import Basis from '../layouts/Basis.astro';
---

<Basis titel="Mitgliederbereich" beschreibung="Der Mitgliederbereich folgt in Kuerze.">
  <div class="seitenkopf">
    <p class="eyebrow">Mitgliederbereich</p>
    <h1>In Vorbereitung</h1>
    <p class="einleitung">
      Der interne Mitgliederbereich wird derzeit eingerichtet und in Kuerze
      freigeschaltet.
    </p>
  </div>
  <div class="hinweis">
    Diese Online-Vorschau zeigt zunaechst die oeffentlichen Seiten. Der
    angemeldete Mitgliederbereich folgt.
  </div>
</Basis>
`;

async function main() {
  if (existsSync(backup)) {
    throw new Error('Backup-Ordner existiert bereits, bitte pruefen: ' + backup);
  }
  if (existsSync(mitglieder)) await rename(mitglieder, backup);
  await writeFile(platzhalter, PLATZHALTER);
  try {
    execSync('npx astro build', {
      stdio: 'inherit',
      env: { ...process.env, STATIC_ONLY: 'true' },
    });
  } finally {
    await rm(platzhalter, { force: true });
    if (existsSync(backup)) await rename(backup, mitglieder);
  }
  console.log('\nStatischer Build fertig in ./dist (nur oeffentliche Seiten).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

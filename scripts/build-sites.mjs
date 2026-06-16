// Baut alle Vereinsseiten als rein statische Bundles in je einen Unterordner
// von ./dist und erzeugt eine Uebersichtsseite (dist/index.html) mit Links.
// Der serverseitige Mitgliederbereich wird fuer diesen Build durch eine
// schlichte Platzhalter-Seite ersetzt (echtes src/pages/mitglieder bleibt
// unangetastet). Gedacht fuer GitHub Pages: ein Repo, drei teilbare Links.
import { rename, writeFile, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const mitglieder = join(root, 'src', 'pages', 'mitglieder');
const backup = join(root, 'src', 'pages', '_mitglieder_backup');
const platzhalter = join(root, 'src', 'pages', 'mitglieder.astro');
const dist = join(root, 'dist');

// Welche Vereine, in welcher Reihenfolge, mit welchem Theme (nur fuer Anzeige).
const SITES = [
  { id: 'goerlitz', name: 'Anbauvereinigung Goerlitz', stadt: 'Goerlitz', theme: 'botanik' },
  { id: 'goerlitz2', name: 'CSC Goerlitz', stadt: 'Goerlitz', theme: 'klar' },
  { id: 'leipzig', name: 'Anbauvereinigung Leipzig', stadt: 'Leipzig', theme: 'warm' },
];

// Basis-Pfad des Repos (z. B. /canna-vereine/). Lokal Default '/'.
let repoBase = process.env.BASE_PATH || '/';
if (!repoBase.startsWith('/')) repoBase = '/' + repoBase;
if (!repoBase.endsWith('/')) repoBase += '/';

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

function landing() {
  const karten = SITES.map(
    (s) => `      <li class="karte">
        <a href="${repoBase}${s.id}/">
          <span class="karte__name">${s.name}</span>
          <span class="karte__meta">${s.stadt} &middot; Design: ${s.theme}</span>
        </a>
      </li>`,
  ).join('\n');
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Vereinsseiten Vorschau</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #1f2422; background: #f5f6f4; line-height: 1.6; }
      main { max-width: 40rem; margin: 0 auto; padding: 3rem 1.25rem 4rem; }
      h1 { font-size: 1.6rem; margin: 0 0 0.4rem; }
      .unter { color: #55605a; margin: 0 0 2rem; }
      ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.8rem; }
      .karte a { display: block; padding: 1.1rem 1.3rem; background: #fff; border: 1px solid #e0e3df; border-radius: 8px; text-decoration: none; color: inherit; }
      .karte a:hover { border-color: #b9c2bb; }
      .karte__name { display: block; font-weight: 600; font-size: 1.1rem; }
      .karte__meta { display: block; color: #55605a; font-size: 0.9rem; margin-top: 0.2rem; }
      .fuss { color: #6b756f; font-size: 0.85rem; margin-top: 2rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Anbauvereinigungen, Vorschau der Seiten</h1>
      <p class="unter">Interne Vorschau zur Abstimmung. Jede Seite hat ein eigenes Design.</p>
      <ul>
${karten}
      </ul>
      <p class="fuss">
        Tipp: Jedes Design laesst sich auf jeder Seite testen, indem man der
        Adresse <code>?theme=botanik</code>, <code>?theme=klar</code>,
        <code>?theme=warm</code> oder <code>?theme=nacht</code> anhaengt.
      </p>
    </main>
  </body>
</html>
`;
}

async function main() {
  if (existsSync(backup)) {
    throw new Error('Backup-Ordner existiert bereits, bitte pruefen: ' + backup);
  }
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  if (existsSync(mitglieder)) await rename(mitglieder, backup);
  await writeFile(platzhalter, PLATZHALTER);
  try {
    for (const s of SITES) {
      const siteBase = `${repoBase}${s.id}/`;
      console.log(`\n=== Baue ${s.id} (Theme ${s.theme}, Basis ${siteBase}) ===`);
      execSync(`npx astro build --outDir dist/${s.id}`, {
        stdio: 'inherit',
        env: {
          ...process.env,
          STATIC_ONLY: 'true',
          SITE_ID: s.id,
          BASE_PATH: siteBase,
        },
      });
    }
  } finally {
    await rm(platzhalter, { force: true });
    if (existsSync(backup)) await rename(backup, mitglieder);
  }

  await writeFile(join(dist, 'index.html'), landing());
  console.log('\nAlle Seiten gebaut in ./dist (plus Uebersicht index.html).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Multi-Mandanten-Onboarding: legt einen neuen Verein an.
//
//   node scripts/neuer-verein.mjs --slug=zittau --name="Cannabis-Verein Zittau e. V." \
//     --kurzname="Cannabis-Verein Zittau" --kuerzel=CVZ --stadt=Zittau --plz=02763 \
//     --domain=zittau.example.de --email=kontakt@zittau.example.de [--theme=nacht] [--oeffentlich]
//
// Erzeugt src/config/<slug>.ts, registriert die Site in src/config/index.ts und
// gibt fertige Bausteine für docker-compose.yml, Caddyfile und .env sowie eine
// Schritt-für-Schritt-Checkliste aus. Fasst KEINE Server-Dateien direkt an
// (Compose und das versionierte deploy/sites-Snippet werden kontrolliert
// nachgezogen — siehe deploy/ONBOARDING.md).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wurzel = resolve(__dirname, '..');

// --- Argumente parsen ---
const args = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args[m[1]] = m[2] ?? true;
}
const pflicht = ['slug', 'name', 'kurzname', 'stadt', 'plz', 'domain', 'email'];
const fehlt = pflicht.filter((k) => !args[k]);
if (fehlt.length) {
  console.error('Fehlende Argumente: ' + fehlt.map((f) => '--' + f).join(', '));
  console.error('Beispiel: node scripts/neuer-verein.mjs --slug=zittau --name="Cannabis-Verein Zittau e. V." --kurzname="Cannabis-Verein Zittau" --kuerzel=CVZ --stadt=Zittau --plz=02763 --domain=zittau.example.de --email=kontakt@zittau.example.de');
  process.exit(1);
}

const slug = String(args.slug).toLowerCase();
if (!/^[a-z][a-z0-9]*$/.test(slug)) {
  console.error('Ungültiger slug: nur Kleinbuchstaben/Ziffern, Beginn mit Buchstabe (z. B. "zittau").');
  process.exit(1);
}
const SLUG_UP = slug.toUpperCase();
const theme = args.theme === 'klar' ? 'klar' : 'nacht';
const oeffentlich = !!args.oeffentlich;
const kuerzelZeile = args.kuerzel ? `\n  kuerzel: '${args.kuerzel}',` : '';

// --- 1) Config-Datei erzeugen ---
const configPfad = resolve(wurzel, 'src/config', `${slug}.ts`);
if (existsSync(configPfad)) {
  console.error(`Abbruch: ${configPfad} existiert bereits.`);
  process.exit(1);
}
const config = `import type { SiteConfig } from './types';

// Verein ${args.name}. Felder mit "TODO" vor dem Livegang mit echten Daten füllen.
export const ${slug}: SiteConfig = {
  id: '${slug}',
  theme: '${theme}',
  layout: 'sidebar',
  oeffentlich: ${oeffentlich},
  vereinsname: '${args.name}',
  kurzname: '${args.kurzname}',${kuerzelZeile}
  stadt: '${args.stadt}',
  registereintrag: 'TODO: VR-Nummer, Amtsgericht',
  erlaubnisHinweis:
    'Erlaubnis zum gemeinschaftlichen Eigenanbau nach Paragraf 11 KCanG: TODO Aktenzeichen / Status',

  kontakt: {
    strasse: 'TODO Straße und Hausnummer',
    plz: '${args.plz}',
    ort: '${args.stadt}',
    email: '${args.email}',
    telefon: undefined,
    erreichbarkeit: 'Schriftliche Anfragen werden innerhalb weniger Werktage beantwortet.',
  },

  vorstand: [
    { name: 'TODO Vorname Nachname', rolle: 'Vorsitz' },
    { name: 'TODO Vorname Nachname', rolle: 'Stellvertretung' },
  ],

  praeventionsbeauftragter: {
    name: 'TODO Vorname Nachname',
    rolle: 'Präventionsbeauftragte Person nach Paragraf 23 KCanG',
    email: 'praevention@TODO-${slug}-domain.de',
  },

  externeBeratung: [
    {
      name: 'BZgA: Infotelefon zur Suchtvorbeugung',
      beschreibung: 'Bundeszentrale für gesundheitliche Aufklärung, anonyme Beratung.',
      telefon: '0221 892031',
      url: 'https://www.bzga.de',
    },
    {
      name: 'Sucht und Drogen Hotline',
      beschreibung: 'Bundesweite telefonische Beratung, rund um die Uhr.',
      telefon: '01806 313031',
    },
  ],

  dokumente: {
    satzungPdf: undefined,
    beitragsordnungPdf: undefined,
    gesundheitskonzeptPdf: undefined,
    jugendschutzkonzeptPdf: undefined,
  },

  impressum: {
    vertretungsberechtigt: 'TODO Vorstand laut Paragraf 26 BGB',
    ustId: undefined,
    inhaltlichVerantwortlich: 'TODO Name, Anschrift wie oben',
  },
};
`;
writeFileSync(configPfad, config, 'utf8');
console.log(`✓ src/config/${slug}.ts erzeugt`);

// --- 2) In index.ts registrieren ---
const indexPfad = resolve(wurzel, 'src/config/index.ts');
let index = readFileSync(indexPfad, 'utf8');
if (!index.includes(`from './${slug}'`)) {
  index = index.replace(
    /(import \{ leipzig \} from '\.\/leipzig';\n)/,
    `$1import { ${slug} } from './${slug}';\n`,
  );
  index = index.replace(/(\n  leipzig,\n)/, `$1  ${slug},\n`);
  writeFileSync(indexPfad, index, 'utf8');
  console.log('✓ src/config/index.ts registriert');
} else {
  console.log('• index.ts kannte den Verein schon');
}

// --- 3) Infra-Bausteine ausgeben ---
const compose = `
  # ---------- ${args.kurzname} ----------
  astro-${slug}:
    build:
      context: ..
      dockerfile: deploy/Dockerfile.astro
      args:
        SITE_ID: ${slug}
    restart: unless-stopped
    env_file: .env
    environment:
      PB_URL: http://pb-${slug}:8090
      PB_PUBLIC_URL: https://\${DOMAIN_${SLUG_UP}}
    depends_on:
      - pb-${slug}
  pb-${slug}:
    build:
      context: ..
      dockerfile: deploy/Dockerfile.pocketbase
    restart: unless-stopped
    volumes:
      - pb_${slug}:/pb/pb_data`;

const caddy = `
{$DOMAIN_${SLUG_UP}} {
	@userauth path /api/collections/users/auth-with-password /api/collections/users/auth-refresh /api/collections/users/request-password-reset
	handle @userauth {
		respond "Anmeldung nur ueber die Website." 403
	}
	@pb path /api/* /_/*
	handle @pb {
		reverse_proxy pb-${slug}:8090
	}
	handle {
		reverse_proxy astro-${slug}:4321
	}
}`;

console.log('\n════════ Bausteine für die Infrastruktur (von Hand nachziehen) ════════');
console.log('\n① deploy/docker-compose.yml — Dienste einfügen (vor dem "volumes:"-Block):');
console.log(compose);
console.log(`\n   … und beim "volumes:"-Block ergänzen:\n  pb_${slug}:`);
console.log('\n② deploy/sites/cvms.caddy — versionierten Domain-Block ergänzen:');
console.log(caddy);
console.log(`\n③ deploy/.env auf dem Server — Zeile ergänzen:\n  DOMAIN_${SLUG_UP}=${args.domain}`);
console.log('\n④ DNS: A-/AAAA-Record für ' + args.domain + ' auf den VPS zeigen lassen.');
console.log('\n⑤ Danach: siehe deploy/ONBOARDING.md (Build, Superuser, Struktur-Seeds, System-Konto).');
console.log('\nFertig — Code-Seite steht. Bitte config-TODOs füllen und Schritte ①–⑤ ausführen.');

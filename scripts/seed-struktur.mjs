// Struktur-Seeds für einen neuen Verein in Reihenfolge ausführen. Erwartet
// PB_URL / PB_ADMIN_EMAIL / PB_ADMIN_PW in der Umgebung (Superuser der Ziel-PB).
// Alle Seeds sind idempotent -> ein erneuter Lauf ist unschädlich und setzt
// nach einem Fehler dort wieder auf.
//
//   PB_URL=https://<domain> PB_ADMIN_EMAIL=… PB_ADMIN_PW=… node scripts/seed-struktur.mjs
//
// Hinweis: Einige Basis-Seeds legen wenige Beispiel-/Referenzdatensätze an
// (z. B. Muster-Charge). Für einen echten Verein diese nach dem Seeden im
// Admin prüfen und ggf. löschen. Das System-Konto für die Automatik wird NICHT
// hier angelegt (eigene Creds nötig): scripts/seed-system-konto.mjs.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Reihenfolge ist wichtig: erst Basis-Schema + Kern-Collections, dann die
// erweiternden Feature-Seeds.
const SEEDS = [
  'seed.mjs',                  // Basis: Mitteilungen, Termine, Dokumente …
  'seed-ausgabe.mjs',          // users-Felder, sorten, ausgaben
  'seed-wawi.mjs',             // chargen, vernichtungen, Rollen
  'seed-verarbeitung.mjs',     // produkt_typ, verarbeitungen
  'seed-produkte.mjs',
  'seed-sorten.mjs',
  'seed-mitglieder-rechte.mjs',
  'seed-kasse.mjs',            // Feature 1
  'seed-aufnahmebeitrag.mjs',  // Kasse: Aufnahmebeitrag
  'seed-storno.mjs',           // Feature 2
  'seed-mahnwesen.mjs',        // Feature 3
  'seed-rueckruf.mjs',         // Feature 4
  'seed-audit.mjs',            // Feature 6
  'seed-status.mjs',           // Feature 8
  'seed-einwilligung.mjs',     // Feature 9
  'seed-termine-rsvp.mjs',     // Feature 10
  'seed-einstellungen.mjs',    // Laufzeit-Module
  'seed-kassen-konnektor.mjs', // externe Kasse
  'seed-bewertungen.mjs',      // Sortenbewertung
  'seed-brett.mjs',            // Schwarzes Brett
  'seed-schlank.mjs',          // Aushang-Rechte, reset_email, Vorbestellungs-Admin
  'seed-angebot.mjs',
  'seed-anleitungen.mjs',
  'seed-abstimmungen.mjs',
  'seed-anbauplan.mjs',
  'seed-push.mjs',
  'seed-sepa.mjs',
  'seed-erweiterung.mjs',
  'seed-selbstverwaltung.mjs', // Feature 7 - NACH erweiterung (setzt users.updateRule final)
];

if (!process.env.PB_URL || !process.env.PB_ADMIN_EMAIL || !process.env.PB_ADMIN_PW) {
  console.error('Bitte PB_URL, PB_ADMIN_EMAIL und PB_ADMIN_PW setzen.');
  process.exit(1);
}

console.log(`Struktur-Seeds gegen ${process.env.PB_URL} (${SEEDS.length} Skripte)\n`);
let ok = 0;
for (const s of SEEDS) {
  const pfad = resolve(__dirname, s);
  process.stdout.write(`▶ ${s} … `);
  try {
    execFileSync('node', [pfad], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    console.log('ok');
    ok += 1;
  } catch (e) {
    console.log('FEHLER');
    console.error(String(e.stdout ?? '') + String(e.stderr ?? ''));
    console.error(`\nAbbruch bei ${s}. Ursache oben. Nach Behebung erneut starten — erledigte Seeds sind idempotent.`);
    process.exit(1);
  }
}
console.log(`\n✓ ${ok}/${SEEDS.length} Struktur-Seeds durch. Danach: seed-system-konto.mjs (Automatik) + Superuser anlegen.`);

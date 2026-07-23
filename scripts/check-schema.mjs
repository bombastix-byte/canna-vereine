import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL;
const ADMIN_PW = process.env.PB_ADMIN_PW;
if (!ADMIN || !ADMIN_PW) {
  console.error('PB_ADMIN_EMAIL und PB_ADMIN_PW muessen gesetzt sein.');
  process.exit(2);
}

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);

let fehler = 0;
function pruefe(name, bedingung, info = '') {
  if (!bedingung) fehler++;
  console.log(`${bedingung ? 'PASS' : 'FAIL'}  ${name}${bedingung ? '' : `  ${info}`}`);
}

const users = await pb.collections.getOne('users');
const ausgaben = await pb.collections.getOne('ausgaben');

pruefe('users.createRule nur Vorstand', users.createRule?.includes('rollen ~ "vorstand"'), users.createRule);
pruefe('users.manageRule nur Vorstand', users.manageRule?.includes('rollen ~ "vorstand"'), users.manageRule);
pruefe('users.updateRule schuetzt Rollen', users.updateRule?.includes('rollen:isset = false'), users.updateRule);
pruefe('users.updateRule erlaubt eigenes Konto kontrolliert', users.updateRule?.includes('id = @request.auth.id'), users.updateRule);
pruefe('ausgaben.createRule ist rollenbegrenzt', ausgaben.createRule?.includes('rollen ~ "ausgabe"'), ausgaben.createRule);
pruefe('ausgaben.deleteRule ist gesperrt', ausgaben.deleteRule === null, ausgaben.deleteRule);
pruefe('ausgaben.updateRule friert Menge ein', ausgaben.updateRule?.includes('menge_gramm:isset = false'), ausgaben.updateRule);
pruefe('ausgaben.updateRule erlaubt nur Storno', ausgaben.updateRule?.includes('storniert = true'), ausgaben.updateRule);

const indexes = Array.isArray(ausgaben.indexes) ? ausgaben.indexes.join('\n') : String(ausgaben.indexes ?? '');
for (const name of ['idx_ausgaben_mitglied_monat', 'idx_ausgaben_tag', 'idx_ausgaben_belegnr']) {
  pruefe(`ausgaben Index ${name}`, indexes.includes(name), indexes);
}

const usersIndexes = Array.isArray(users.indexes) ? users.indexes.join('\n') : String(users.indexes ?? '');
pruefe('users Mitgliedsnummer Unique-Index', usersIndexes.includes('idx_users_mitgliedsnummer_unique'), usersIndexes);

if (fehler) process.exit(1);
console.log('\nSCHEMA-/REGELPRUEFUNG BESTANDEN');

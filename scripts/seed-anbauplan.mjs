// Grow-Cockpit (idempotent): Anbau-Plaene mit Schritten je Zyklustag,
// Pflege-Protokoll, Plan-Zuweisung an Chargen.
//  - anbau_plaene: benannte Schemata (z. B. "Standard Photoperiode")
//  - plan_schritte: Phase/Pflege/Duengung/Kontrolle je Zyklustag, optional
//    wiederholend ("ab Tag 14 alle 3 Tage") und mit Anleitung (SOP) verknuepft
//  - pflege_log: wer hat welchen Schritt an welchem Zyklustag erledigt
//  - chargen.plan: welches Schema die Charge faehrt
import PocketBase from 'pocketbase';
import { REGEL } from '../src/lib/rollen.ts';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const ADMIN = process.env.PB_ADMIN_EMAIL ?? 'admin@example.local';
const ADMIN_PW = process.env.PB_ADMIN_PW ?? 'change-me-admin';

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN, ADMIN_PW);
console.log('Admin authentifiziert.');

async function ensureCollection(def) {
  try {
    await pb.collections.getOne(def.name);
    console.log('Collection vorhanden:', def.name);
  } catch {
    await pb.collections.create(def);
    console.log('Collection angelegt:', def.name);
  }
}
async function ensureFeld(collection, feld) {
  const col = await pb.collections.getOne(collection);
  if ((col.fields ?? []).some((f) => f.name === feld.name)) return;
  await pb.collections.update(collection, { fields: [...col.fields, feld] });
  console.log(`${collection}: Feld ${feld.name} ergaenzt.`);
}

const usersId = (await pb.collections.getOne('users')).id;
const chargenId = (await pb.collections.getOne('chargen')).id;
const anleitungenId = (await pb.collections.getOne('anleitungen')).id;

await ensureCollection({
  name: 'anbau_plaene',
  type: 'base',
  listRule: REGEL.wareLesen,
  viewRule: REGEL.wareLesen,
  createRule: REGEL.anbau,
  updateRule: REGEL.anbau,
  deleteRule: null,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'beschreibung', type: 'text' },
    { name: 'aktiv', type: 'bool' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
});
const plaeneId = (await pb.collections.getOne('anbau_plaene')).id;

await ensureCollection({
  name: 'plan_schritte',
  type: 'base',
  listRule: REGEL.wareLesen,
  viewRule: REGEL.wareLesen,
  createRule: REGEL.anbau,
  updateRule: REGEL.anbau,
  deleteRule: REGEL.anbau,
  fields: [
    { name: 'plan', type: 'relation', required: true, maxSelect: 1, collectionId: plaeneId, cascadeDelete: true },
    { name: 'tag_von', type: 'number', required: true }, // Zyklustag, 1-basiert
    { name: 'titel', type: 'text', required: true },
    { name: 'typ', type: 'select', maxSelect: 1, values: ['phase', 'pflege', 'duengung', 'kontrolle'] },
    { name: 'details', type: 'text' }, // z. B. "BioGrow 2 ml/L, EC 1,2"
    { name: 'wiederholung_tage', type: 'number' }, // leer/0 = einmalig
    { name: 'anleitung', type: 'relation', maxSelect: 1, collectionId: anleitungenId, cascadeDelete: false },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  ],
});
const schritteId = (await pb.collections.getOne('plan_schritte')).id;

await ensureCollection({
  name: 'pflege_log',
  type: 'base',
  listRule: REGEL.wareLesen,
  viewRule: REGEL.wareLesen,
  createRule: REGEL.anbau,
  updateRule: null,
  deleteRule: null,
  fields: [
    { name: 'charge_ref', type: 'relation', required: true, maxSelect: 1, collectionId: chargenId, cascadeDelete: true },
    { name: 'schritt', type: 'relation', required: true, maxSelect: 1, collectionId: schritteId, cascadeDelete: false },
    { name: 'zyklustag', type: 'number', required: true },
    { name: 'datum', type: 'text' }, // 'YYYY-MM-DD'
    { name: 'person', type: 'relation', maxSelect: 1, collectionId: usersId, cascadeDelete: false },
    { name: 'notiz', type: 'text' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  ],
});

await ensureFeld('chargen', {
  name: 'plan',
  type: 'relation',
  maxSelect: 1,
  collectionId: plaeneId,
  cascadeDelete: false,
});

// ---------- Demo-Plan ----------
let plan;
try {
  plan = await pb.collection('anbau_plaene').getFirstListItem('name="Standard Photoperiode (~12 Wochen)"');
  console.log('Demo-Plan vorhanden.');
} catch {
  plan = await pb.collection('anbau_plaene').create({
    name: 'Standard Photoperiode (~12 Wochen)',
    beschreibung:
      'Referenz-Zyklus fuer photoperiodische Sorten: 6 Wochen Wachstum, 6 Wochen Bluete. Tage zaehlen ab Anbaubeginn der Charge.',
    aktiv: true,
  });
  const giessenSop = await pb.collection('anleitungen').getFirstListItem('titel="Gießen"').catch(() => null);
  const schritte = [
    { tag_von: 1, titel: 'Keimung / Anzucht', typ: 'phase' },
    { tag_von: 1, titel: 'Anzucht feucht halten (Sprühflasche)', typ: 'pflege', wiederholung_tage: 1, details: 'Nur besprühen, nicht gießen. Ab sichtbarem Keimblatt normal gießen.', anleitung: giessenSop?.id ?? null },
    { tag_von: 10, titel: 'Vegetation', typ: 'phase' },
    { tag_von: 10, titel: 'Umtopfen in 11-Liter-Töpfe', typ: 'pflege', details: 'Vorsichtig am Wurzelballen, danach angießen.' },
    { tag_von: 14, titel: 'Wuchsdünger', typ: 'duengung', wiederholung_tage: 3, details: 'BioGrow 2 ml/L, EC 1,0–1,2 · pH 6,0–6,5' },
    { tag_von: 25, titel: 'Topping (Haupttrieb kappen)', typ: 'pflege', details: 'Über dem 5. Nodium schneiden, Werkzeug desinfizieren.' },
    { tag_von: 35, titel: 'Vorblüte-Check und Rückschnitt', typ: 'kontrolle', details: 'Untere Triebe auslichten (Lollipopping), Männchen aussortieren.' },
    { tag_von: 42, titel: 'Blüte (12/12 einleiten)', typ: 'phase' },
    { tag_von: 42, titel: 'Lichtzyklus auf 12/12 umstellen', typ: 'pflege', details: 'Zeitschaltuhr prüfen — absolute Dunkelphase sicherstellen.' },
    { tag_von: 45, titel: 'Blütedünger', typ: 'duengung', wiederholung_tage: 3, details: 'BioBloom 2,5 ml/L, EC 1,4–1,6 · pH 6,0–6,5' },
    { tag_von: 77, titel: 'Spülen (nur Wasser)', typ: 'duengung', wiederholung_tage: 2, details: 'Ab jetzt kein Dünger mehr, nur pH-korrigiertes Wasser.' },
    { tag_von: 84, titel: 'Trichome prüfen — Erntefenster', typ: 'kontrolle', wiederholung_tage: 2, details: 'Lupe: milchig = bereit, bernstein = spät. Ernte mit Vorstand abstimmen.' },
  ];
  for (const s of schritte) await pb.collection('plan_schritte').create({ plan: plan.id, ...s });
  console.log(`Demo-Plan angelegt (${schritte.length} Schritte).`);
}

// Laufende Anbau-Chargen ohne Plan bekommen den Demo-Plan.
const offene = await pb.collection('chargen').getFullList({ filter: 'status="anbau"' });
for (const c of offene) {
  if (!c.plan) {
    await pb.collection('chargen').update(c.id, { plan: plan.id });
    console.log('Plan zugewiesen:', c.charge_nr);
  }
}

console.log('\nFertig. Grow-Cockpit eingerichtet.');

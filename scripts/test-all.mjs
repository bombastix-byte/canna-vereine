import { spawnSync } from 'node:child_process';

const tests = [
  'test-ausgabe.mjs',
  'test-erweiterung.mjs',
  'test-kasse.mjs',
  'test-namen.mjs',
  'test-verarbeitung.mjs',
  'test-origin.mjs',
  'test-deploy.mjs',
  'test-golive.mjs',
  'test-ux.mjs',
];

for (const test of tests) {
  console.log(`\n=== ${test} ===`);
  const lauf = spawnSync(process.execPath, [`scripts/${test}`], { stdio: 'inherit' });
  if (lauf.status !== 0) process.exit(lauf.status ?? 1);
}

console.log(`\nALLE ${tests.length} TESTGRUPPEN BESTANDEN`);

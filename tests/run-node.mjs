import { readFileSync } from 'fs';
import { runTests } from './chem-tests.js';
const data = JSON.parse(readFileSync(new URL('../data/molecules.json', import.meta.url)));
const r = runTests(data); r.forEach(x => console.log(x.ok ? 'OK  ' : 'FAIL', x.name));
console.log(`${r.filter(x => x.ok).length}/${r.length} tests réussis`); process.exit(r.every(x => x.ok) ? 0 : 1);

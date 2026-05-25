import { readFileSync } from 'node:fs';

const files = ['firebase.json', 'firestore.indexes.json'];

for (const file of files) {
  JSON.parse(readFileSync(file, 'utf8'));
}

console.log(`Validated ${files.join(', ')}`);

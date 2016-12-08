import { exec } from 'shelljs';

console.log('>> Linting source');
const code1 = exec('node ./node_modules/.bin/tslint --project tsconfig.json').code;

console.log('>> Linting tests');
const code2 = exec('node ./node_modules/.bin/tslint --project tests/tsconfig.json').code;

console.log('>> Done linting');

if (code1 || code2) {
	process.exit(1);
}

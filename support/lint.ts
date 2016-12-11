import { echo } from 'shelljs';
import { exec } from './common';

echo('>> Linting source');
exec('node ./node_modules/.bin/tslint --project tsconfig.json');

echo('>> Linting tests');
exec('node ./node_modules/.bin/tslint --project tests/tsconfig.json');

echo('>> Done linting');

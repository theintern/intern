import { rm } from 'shelljs';
import { log } from './lib/util';

const baseDir = `${__dirname}/..`;

// Use -f to silence warnings when directories don't exist
rm('-rf', `${baseDir}/_build`);
rm('-rf', `${baseDir}/_examples`);
rm('-rf', `${baseDir}/_tests`);
rm('-rf', `${baseDir}/_testIntern`);
rm(`${baseDir}/*.tsbuildinfo`);

log('Done cleaning');

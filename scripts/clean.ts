import { rm } from 'shelljs';
import { log } from './lib/util';

// Use -f to silence warnings when directories don't exist
rm('-rf', `${__dirname}/../_build`);
rm('-rf', `${__dirname}/../_examples`);
rm('-rf', `${__dirname}/../_tests`);
rm('-rf', `${__dirname}/../_testIntern`);

log('Done cleaning');

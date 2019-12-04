import { rm } from 'shelljs';
import { log } from './lib/util';

rm('-r', `${__dirname}/../_build`);
rm('-r', `${__dirname}/../_tests`);

log('Done cleaning');

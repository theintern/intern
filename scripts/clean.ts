import { rm } from 'shelljs';
import { log } from './lib/util';

rm('-r', `${__dirname}/../_build`);
rm('-r', `${__dirname}/../_tests`);
rm('-r', `${__dirname}/../_testIntern`);

log('Done cleaning');

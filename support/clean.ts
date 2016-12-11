import { echo, rm } from 'shelljs';
import { buildDir } from './common';

echo(`>> Cleaning`);

rm('-rf', buildDir);
if (process.argv[2] === 'all') {
	rm('-rf', 'node_modules');
	rm('-rf', 'browser_modules');
}

echo('>> Done cleaning');

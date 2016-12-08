import { rm } from 'shelljs';
import { buildDir } from './tsconfig';

console.log(`>> Removing ${buildDir}`);
rm('-rf', buildDir);

if (process.argv[2] === 'all') {
	console.log(`>> Removing installed modules`);
	rm('-rf', 'node_modules');
	rm('-rf', 'browser_modules');
}

console.log('>> Done cleaning');

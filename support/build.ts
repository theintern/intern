import { cp, exec, mkdir, rm, test } from 'shelljs';
import { join, dirname } from 'path';
import * as glob from 'glob';
import { buildDir } from './tsconfig';

let mode: string;
const modes = [ 'dist', 'copyOnly' ];

const arg = process.argv[2];
if (arg) {
	if (modes.indexOf(arg) === -1) {
		console.log('usage: build [dist|copyOnly]');
		console.log('  <default> - build for testing');
		console.log('  dist      - build for distribution');
		console.log('  copyOnly  - copy resources, but don\'t build typescript');
		process.exit(1);
	}
	mode = arg;
}

if (mode !== 'copyOnly') {
	if (mode === 'dist') {
		console.log('>> Linting source');
		if (exec('node ./node_modules/.bin/tslint --project tsconfig.json').code) {
			process.exit(1);
		}
	}

	console.log('>> Removing existing build directory');
	if (test('-d', buildDir)) {
		rm('-r', buildDir);
	}

	console.log('>> Compiling source');
	if (exec('node ./node_modules/.bin/tsc').code) {
		process.exit(1);
	}

	if (mode !== 'dist') {
		console.log('>> Compiling tests');
		if (exec('node ./node_modules/.bin/tsc -p tests/tsconfig.json').code) {
			process.exit(1);
		}
	}
}

console.log('>> Copying resources');
let patterns = [
	'.npmignore',
	'./*.{md,html}',
	'package.json',
	'support/fixdeps.js',
	'types/**',
	'bin/*.js',
	'src/**/*.{html,json,css,d.ts}',
	'tests/types/intern/**'
];

if (mode === 'dist') {
	patterns.push('tests/example.*');
}
else {
	patterns.push('tests/**/*.{html,json}');
}

patterns.forEach(function (pattern) {
	glob.sync(pattern).forEach(function (resource) {
		const dst = join(buildDir, resource);
		const dstDir = dirname(dst);
		if (!test('-d', dstDir)) {
			mkdir('-p', dstDir);
		}
		if (!test('-d', resource)) {
			cp(resource, dst);
		}
	});
});

console.log('>> Done building');

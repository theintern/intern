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

	console.log('>> Compiling grunt task');
	if (exec('node ./node_modules/.bin/tsc -p tasks/tsconfig.json').code) {
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

let copyAll = function (patterns: string[], outDir: string) {
	patterns.forEach(function (pattern) {
		glob.sync(pattern).filter(function (resource) {
			return test('-f', resource);
		}).forEach(function (filename) {
			const dst = join(outDir, filename);
			const dstDir = dirname(dst);
			if (!test('-d', dstDir)) {
				mkdir('-p', dstDir);
			}
			cp(filename, dst);
		});
	});
};

copyAll([
	'.npmignore',
	'./*.{md,html}',
	'package.json',
	'support/fixdeps.js',
	'types/**',
	'bin/*.js',
	'tests/types/intern/**',
	'tests/example.*'
], join(buildDir, 'src'));

copyAll([
	'src/**/*.{html,json,css,d.ts}',
	'tests/**/*.{html,json}'
], buildDir);

console.log('>> Done building');

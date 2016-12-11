import { cp, echo, mkdir, rm, test } from 'shelljs';
import { join, dirname } from 'path';
import * as glob from 'glob';
import { buildDir, exec } from './common';

let mode: string;
const modes = [ 'dist', 'copyOnly' ];

const arg = process.argv[2];
if (arg) {
	if (modes.indexOf(arg) === -1) {
		echo('usage: build [dist|copyOnly]');
		echo('  <default> - build for testing');
		echo('  dist      - build for distribution');
		echo('  copyOnly  - copy resources, but don\'t build typescript');
		process.exit(1);
	}
	mode = arg;
}

if (mode !== 'copyOnly') {
	if (mode === 'dist') {
		echo('>> Linting source');
		exec('node ./node_modules/.bin/tslint --project tsconfig.json');
	}

	echo('>> Removing existing build directory');
	if (test('-d', buildDir)) {
		rm('-r', buildDir);
	}

	echo('>> Compiling source');
	exec('node ./node_modules/.bin/tsc');

	echo('>> Compiling grunt task');
	exec('node ./node_modules/.bin/tsc -p tasks/tsconfig.json');

	if (mode !== 'dist') {
		echo('>> Compiling tests');
		exec('node ./node_modules/.bin/tsc -p tests/tsconfig.json');
	}
}

echo('>> Copying resources');

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

echo('>> Done building');

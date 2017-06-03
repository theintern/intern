// If _build/src/**/*.js changes, re-run browserify.
// If a resource in src/ or tests/ changes, copy it.

import { watch } from 'chokidar';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { mkdir } from 'shelljs';
import { red } from 'chalk';
import { sync as glob } from 'glob';
import { readFileSync, writeFileSync } from 'fs';

function log(...args: any[]) {
	console.log(`${new Date().toLocaleTimeString()} -`, ...args);
}

[
	{ dir: '.', src: 'src', dst: '_build' },
	{ dir: 'tests', src: 'tests', dst: '_tests' }
].forEach(info => {
	function copy(file: string) {
		const dst = join(info.dst, file);
		mkdir('-p', dirname(dst));
		writeFileSync(dst, readFileSync(file));
		log(`Copied ${file} -> ${dst}`);
	}

	const paths = [
		join(info.src, '**', '*.css'),
		join(info.src, '**', '*.xml'),
		join(info.src, '**', '*.json'),
		join(info.src, '**', '*.d.ts'),
		join(info.src, '**', '*.html'),
		join(info.src, '**', '*.png')
	];

	// Initially copy over all resources
	paths.forEach(pattern => {
		glob(pattern).forEach(copy);
	});

	const resourceWatcher = watch(paths)
		.on('ready', () => {
			log(`Watching files in ${info.dst}`);
			resourceWatcher.on('add', copy);
			resourceWatcher.on('change', copy);
			resourceWatcher.on('unlink', copy);
		})
		.on('error', (error: Error) => {
			log(red(`!!`), 'Watcher error:', error);
		});

	log(`Starting tsc watcher for ${info.src}`);

	const child = spawn('tsc', ['--watch', '--project', info.dir ]);
	child.stdout.on('data', (data: Buffer) => {
		data.toString('utf8').split('\n')
			.filter(line => line !== '')
			.map(line => /\berror TS\d+:/.test(line) ? red(line) : line)
			.forEach(line => { console.log(`[${info.dir}] ${line}`); });
	});
});

spawn('webpack', ['--watch', '--hide-modules'], { stdio: 'inherit' });

#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { sync as resolve } from 'resolve';

import { acceptVersion, die, getLogger, print } from '../lib/util';
import cli3, {
	minVersion as cli3Min,
	maxVersion as cli3Max
} from '../lib/cli3';
import cli4, {
	minVersion as cli4Min,
	maxVersion as cli4Max
} from '../lib/cli4';

let internDir: any;
let internPkg: any;

try {
	internDir = dirname(resolve('intern', { basedir: process.cwd() }));
	internPkg = JSON.parse(
		readFileSync(join(internDir, 'package.json'), { encoding: 'utf8' })
	);
} catch (error) {
	die([
		'You will need a local install of Intern before you can use this ' +
			'command. Install it with',
		'',
		'  npm install --save-dev intern'
	]);
}

const pkg = require('../../../package.json');
const minVersion = '3.0.0';
const program = new Command();
let vlog = getLogger();

program
	.description('Run JavaScript tests')
	.option('-v, --verbose', 'show more information about what Intern is doing')
	.option('-V, --version', 'output the version')
	.on('version', () => {
		print();
		print(`intern-cli: ${pkg.version}`);
		if (internDir) {
			print(`intern: ${internPkg.version}`);
		}
		print();
	})
	.on('verbose', () => {
		vlog = getLogger(true);
	});

const context = { program, vlog, internDir };

if (acceptVersion(internPkg.version, cli3Min, cli3Max)) {
	cli3(context);
} else if (acceptVersion(internPkg.version, cli4Min, cli4Max)) {
	cli4(context);
} else {
	die(
		`This command requires Intern ${minVersion} or newer (` +
			`${internPkg.version} is installed).`
	);
}

program.parse(process.argv);

// If no command was given, show the help message
if (process.argv.length === 2) {
	program.outputHelp();
}

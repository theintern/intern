#!/usr/bin/env node

var spawn = require('child_process').spawnSync;

function run(script, extra) {
	if (/^win/.test(process.platform)) {
		script += '.cmd';
	}

	var args = [];
	if (extra) {
		args = args.concat(extra);
	}

	var hasConfig = args.some(function (arg) {
		return arg.indexOf('config=') === 0;
	});
	if (!hasConfig) {
		args.push('config=tests/selftest.intern.js');
	}

	spawn(script, args, { stdio: 'inherit' });
}

var mode = 'local';
var args = process.argv.slice(2);
var modes = {
	all: function (args) {
		run('intern-client', args);
		run('intern-runner', args);
	},
	remote: function (args) {
		run('intern-runner', args);
	},
	local: function (args) {
		run('intern-client', args);
	}
};

if (args[0] in modes) {
	mode = args[0];
	args = args.slice(1);
}

modes[mode](args);

#!/usr/bin/env node

var mode = process.argv[2] || 'local';
var spawn = require('child_process').spawnSync

function run(runner, config, userArgs) {
	spawn('node', [
		'node_modules/intern/' + runner,
		'config=dist/tests/' + config + '.js'
	].concat(userArgs), { stdio: 'inherit' });
}

var modes = {
	all: function () {
		run('client', 'selftest.intern', args);
		run('runner', 'selftest.intern', args);
	},
	local: function () {
		run('client', 'selftest.intern', args);
	},
	remote: function () {
		run('runner', 'selftest.intern', args);
	}
};

if (args[0] in modes) {
	mode = args[0];
	args = args.slice(1);
}

modes[mode]();

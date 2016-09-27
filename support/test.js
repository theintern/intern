#!/usr/bin/env node

var mode = process.argv[2];
var spawn = require('child_process').spawnSync

function run() {
	var args = Array.prototype.slice.call(arguments);
	spawn(args[0], args.slice(1), { stdio: 'inherit' });
}

switch (mode) {
case 'all':
	run('intern-client', 'config=tests/selftest.intern.js');
	run('intern-runner', 'config=tests/selftest.intern.js');
	break;
case 'remote':
	run('intern-runner', 'config=tests/selftest.intern.js');
	break;
default:
	run('intern-client', 'config=tests/selftest.intern.js');
}

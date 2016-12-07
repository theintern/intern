var shell = require('shelljs');
var path = require('path');
var glob = require('glob');
var tsconfig = require('../tsconfig.json');
var buildDir = tsconfig.compilerOptions.outDir;

var mode = null;
var modes = [ 'dist', 'copyOnly' ];

var arg = process.argv[2];
if (arg) {
	if (modes.indexOf(arg) === -1) {
		console.log('Invalid argument "' + arg + '"');
		console.log('usage: build [mode]');
		console.log('  mode - one of {' + modes.join(', ') + '}');
		process.exit(1);
	}
	mode = arg;
}

if (mode !== 'copyOnly') {
	console.log('>> Removing existing build directory');
	if (shell.test('-d', buildDir)) {
		shell.rm('-r', buildDir);
	}

	console.log('>> Compiling source');
	if (shell.exec('node ./node_modules/.bin/tsc').code) {
		process.exit(1);
	}
}

console.log('>> Copying resources');
[
	'.npmignore',
	'./*.{md,html}',
	'package.json',
	'support/fixdeps.js',
	'bin/*.js',
	'src/**/*.{html,json,css}',
	'tests/**/*.{html,json}',
	'tests/example.*'
].forEach(function (pattern) {
	glob.sync(pattern).forEach(function (resource) {
		var dst = path.join(buildDir, resource);
		var dstDir = path.dirname(dst);
		if (!shell.test('-d', dstDir)) {
			shell.mkdir(dstDir);
		}
		shell.cp(resource, dst);
	});
});

if (mode === 'dist') {
	console.log('>> Removing tests');
	glob.sync(buildDir + '/tests/!(example.intern.js)').forEach(function (resource) {
		shell.rm('-r', resource);
	});
}

console.log('>> Done building');

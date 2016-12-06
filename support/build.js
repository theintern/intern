var shell = require('shelljs');
var path = require('path');
var glob = require('glob');
var tsconfig = require('../tsconfig.json');
var buildDir = tsconfig.compilerOptions.outDir;

var mode = null;
var modes = [ 'dist', 'copy' ];

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

if (shell.test('-d', buildDir)) {
	shell.rm('-r', buildDir);
}

if (mode !== 'copy') {
	if (shell.exec('node ./node_modules/.bin/tsc').code) {
		process.exit(1);
	}
}

function copyResource(resource) {
	var dst = path.join(buildDir, resource);
	var dstDir = path.dirname(dst);
	if (!shell.test('-d', dstDir)) {
		shell.mkdir(dstDir);
	}
	shell.cp(resource, dst);
}

glob.sync('src/**/*.{html,json,css}').forEach(copyResource);

if (mode === 'dist') {
	[
		'CONTRIBUTING.md',
		'README.md',
		'LICENSE',
		'package.json',
		'client.html'
	].forEach(function (filename) {
		shell.cp(filename, buildDir);
	});

	shell.mkdir(path.join(buildDir, 'support'));
	shell.cp(path.join('support', 'fixdeps.js'), path.join(buildDir, 'support'));

	shell.cp('-r', 'bin', buildDir);

	shell.rm('-rf', path.join(buildDir, 'tests'));
}
else {
	glob.sync('tests/**/*.{html,json}').forEach(copyResource);
}

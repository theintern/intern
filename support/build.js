var shell = require('shelljs');
var path = require('path');
var glob = require('glob');
var tsconfig = require('../tsconfig.json');
var buildDir = tsconfig.compilerOptions.outDir;

var arg = process.argv[2];
if (arg && arg !== 'dist') {
	console.log('Invalid argument "' + arg + '"; only "dist" is suported');
	process.exit(1);
}

if (shell.exec('node ./node_modules/.bin/tsc').code) {
	process.exit(1);
}

[
	'CONTRIBUTING.md',
	'README.md',
	'LICENSE',
	'package.json',
	'client.html'
].forEach(function (filename) {
	shell.cp(filename, buildDir);
});

if (arg === 'dist') {
	shell.rm('-rf', path.join(buildDir, 'tests'));
}
else {
	glob.sync('tests/**/*.{html,json}').forEach(function (resource) {
		var dst = path.join(buildDir, resource);
		var dstDir = path.dirname(dst);
		if (!shell.test('-d', dstDir)) {
			shell.mkdir(dstDir);
		}
		shell.cp(resource, dst);
	});
}

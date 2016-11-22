var shell = require('shelljs');
var tsconfig = require('../tsconfig.json');
var buildDir = tsconfig.compilerOptions.outDir;

shell.rm('-rf', buildDir);

if (process.argv[2] === 'all') {
	shell.rm('-rf', 'node_modules');
	shell.rm('-rf', 'browser_modules');
}

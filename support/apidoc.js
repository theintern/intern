/* global Promise */
var _util = require('./_util');
var path = require('path');
var rimraf = require('rimraf');

var print = _util.print;
var prompt = _util.prompt;
var run = _util.run;
var rl = _util.rl;

var supportDir;
var rootDir;
var buildDir;

var message = 'This is an internal Dig Dug maintenance script. It updates the\n' +
	'API documentation in the gh-pages branch.\n\n' +
	'If you want to update the API docs, press "y".\n';

prompt(message).then(function (answer) {
	if (answer !== 'y') {
		print('Aborted\n');
		process.exit(0);
	}

	supportDir = __dirname;
	rootDir = path.dirname(__dirname);
	buildDir = path.join(rootDir, 'build_doc');

	print('>> Cloning gh-pages into ' + buildDir + '...\n');
	process.chdir(rootDir);
	return run('git clone -b gh-pages . "' + buildDir + '"');
}).then(function () {
	print('>> Cleaning...\n');
	process.chdir(buildDir);
	return run('git rm -r \'*\'');
}).then(function () {
	print('>> Build docs...\n');
	process.chdir(rootDir);
	return run('jsdoc -c "' + path.join(supportDir, 'jsdoc.conf') + '" -t ' +
		'"../jsdoc-theme/catalyst/" -d "' + buildDir + '" --verbose *.js README.md');
}).then(function () {
	print('>> Committing updated doc files...\n');
	process.chdir(buildDir);
	return run('git add -A').then(function () {
		return run('git commit -a -m "Rebuild documentation"');
	}).then(function () {
		return run('git push origin gh-pages');
	});
}).then(function () {
	print('>> Cleaning up...\n');
	process.chdir(rootDir);
	return new Promise(function (resolve, reject) {
		rimraf(buildDir, function (error) {
			if (error) {
				reject(error);
			}
			else {
				resolve();
			}
		});
	});
}).then(
	function () {
		print('>> Done.\n');
		rl.close();
	},
	function (error) {
		print('>> Build failed!\n');
		print(error.stack);
		rl.close();
		process.exit(1);
	}
);

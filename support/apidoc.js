/* global Promise */
var path = require('path');
var rimraf = require('rimraf');
var fs = require('fs');
var util = require('util');
var exec = require('child_process').exec;

var supportDir;
var rootDir;
var buildDir;

var rl = require('readline').createInterface({
	input: process.stdin,
	output: process.stdout
});

function print() {
	rl.write(util.format.apply(util, arguments));
}

function prompt() {
	var question = util.format.apply(util, arguments);
	return new Promise(function (resolve) {
		rl.question(question, function (answer) {
			resolve(answer);
		});
	});
}

function run(cmd) {
	return new Promise(function (resolve, reject) {
		exec(cmd, function (error, stdout) {
			if (error) {
				reject(error);
			}
			else {
				resolve(stdout);
			}
		});
	});
}

function createRedirectFile(name, newFile, title) {
	if (!title) {
		title = name;
	}

	var text = [
		'<!DOCTYPE html>',
		'<html lang="en">',
		'<head>',
		'  <meta charset="utf-8">',
		'  <title>Leadfoot docs: Module: leadfoot/' + title + '</title>',
		'  <link rel="stylesheet" href="styles/catalyst.css">',
		'  <style>',
		'    p { margin: 2em; font-size: 120%; }',
		'  </style>',
		'</head>',
		'<body>',
		'  <p>This page has moved to <a id="redirect" href="' + newFile + '">' + newFile + '</a>.</p>',
		'  <script>',
		'    // Update the redirect URL with this page\'s hash fragment. This isn\'t guaranteed',
		'    // to work as anchor IDs may have changed.',
		'    var redirect = document.getElementById(\'redirect\');',
		'    redirect.href += location.hash;',
		'  </script>',
		'</body>',
		'</html>'
	];

	return new Promise(function (resolve, reject) {
		fs.writeFile(name + '.html', text, function (error) {
			if (error) {
				reject(error);
			}
			else {
				resolve();
			}
		});
	});
}

var message = 'This is an internal Leadfoot maintenance script. It updates the\n' +
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
		'"../jsdoc-theme/catalyst/" -d "' + buildDir + '" --verbose *.js helpers/*.js README.md');
}).then(function () {
	// Create redirect files
	var names = [ 'Command', 'Element', 'Server', 'Session', 'compat', 'keys' ];
	return names.reduce(function (promise, name) {
		return promise.then(function () {
			return createRedirectFile(name, 'module-leadfoot_' + name + '.html');
		});
	}, Promise.resolve()).then(function () {
		return createRedirectFile('pollUntil', 'module-leadfoot_helpers_pollUntil.html', 'helpers/pollUntil');
	}).then(function () {
		return createRedirectFile('pollUntil.js', 'helpers_pollUntil.js.html', 'helpers/pollUntil.js');
	});
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

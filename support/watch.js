var chokidar = require('chokidar');
var shell = require('shelljs');
var buildTimer;

function scheduleBuild() {
	if (buildTimer) {
		clearTimeout(buildTimer);
	}

	buildTimer = setTimeout(function () {
		buildTimer = null;
		console.log('Building...');
		shell.exec('node ./support/build.js');
		console.log('Done.');
	}, 500);
}

var watcher = chokidar.watch([
	'src/**/*.ts',
	'tests/**/*.ts',
	'tests/**/*.html',
	'tests/**/*.json',
	'package.json'
]).on('ready', function () {
	console.log('Watching...');
	watcher.on('add', scheduleBuild);
	watcher.on('change', scheduleBuild);
	watcher.on('unlink', scheduleBuild);
}).on('error', function (error) {
	console.error('Watcher error:', error);
});

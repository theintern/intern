var chokidar = require('chokidar');
var shell = require('shelljs');
var buildTimer;

function scheduleBuild() {
	if (buildTimer) {
		clearTimeout(buildTimer);
	}

	buildTimer = setTimeout(function () {
		buildTimer = null;
		shell.exec('node ./support/build.js copyOnly');
	}, 500);
}

console.log('>> Starting tsc watcher...');
shell.exec('tsc --watch', { async: true });

var watcher = chokidar.watch([
	'tests/**/*.html',
	'tests/**/*.json',
	'src/**/*.{html,json,css}',
	'package.json'
]).on('ready', function () {
	console.log('>> Watching support files...');
	watcher.on('add', scheduleBuild);
	watcher.on('change', scheduleBuild);
	watcher.on('unlink', scheduleBuild);
}).on('error', function (error) {
	console.error('Watcher error:', error);
});

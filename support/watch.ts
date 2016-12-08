import { watch } from 'chokidar';
import { exec } from 'shelljs';

let buildTimer: any;

function scheduleBuild() {
	if (buildTimer) {
		return;
	}

	buildTimer = setTimeout(function () {
		buildTimer = null;
		exec('node ./support/build.js copyOnly');
	}, 500);
}

console.log('>> Starting tsc watcher...');
exec('tsc --watch', { async: true });

const watcher = watch([
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

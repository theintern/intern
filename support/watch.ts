import { watch } from 'chokidar';
import { echo, exec } from 'shelljs';

let buildTimer: any;

function scheduleBuild() {
	if (!buildTimer) {
		buildTimer = setTimeout(function () {
			buildTimer = null;
			exec('npm run build copyOnly');
		}, 500);
	}
}

echo('>> Starting tsc watcher...');
exec('tsc --watch', { async: true });

const watcher = watch([
	'tests/**/*.html',
	'tests/**/*.json',
	'src/**/*.{html,json,css}',
	'package.json'
]).on('ready', function () {
	echo('>> Watching support files...');
	watcher.on('add', scheduleBuild);
	watcher.on('change', scheduleBuild);
	watcher.on('unlink', scheduleBuild);
}).on('error', function (error) {
	echo('Watcher error:', error);
});

import { echo, exec } from 'shelljs';
import { buildDir } from 'intern-dev/common';
import { join } from 'path';
import { watch } from 'chokidar';
import { red } from 'chalk';

// Importing intern-dev-watch runs the default watch logic
import 'intern-dev/intern-dev-watch';

const watcher = watch(join(buildDir, 'src', '**', '*.js'), {
	ignored: join(buildDir, 'src', 'browser', 'runner.js')
}).on('ready', function () {
	echo(`## Watching files in ${buildDir}`);

	let timer: any;
	function scheduleBuild() {
		timer && clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			exec(`ts-node ${join('support', 'browserify.ts')}`);
		}, 1000);
	}

	watcher.on('add', scheduleBuild);
	watcher.on('change', scheduleBuild);
}).on('error', error => {
	echo(red(error));
});

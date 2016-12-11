import { echo } from 'shelljs';
import { join } from 'path';
import { buildDir, exec } from './tsconfig';

const args = process.argv.slice(2);
let mode = 'local';

function run(runner: string, config: string, userArgs: string[]) {
	let args = [ 'node_modules/intern/' + runner ].concat(userArgs);

	if (!userArgs.some(arg => arg.indexOf('config=') === 0)) {
		args.push('config=' + join(buildDir, 'tests', `${config}.js`));
	}

	echo('>> Running tests');
	exec(`node ${args.join(' ')}`);
	echo('>> Done testing');
}

const modes: { [key: string]: () => void } = {
	all: function () {
		run('client', 'selftest.intern', args);
		run('runner', 'selftest.intern', args);
	},
	local: function () {
		run('client', 'selftest.intern', args);
	},
	remote: function () {
		run('runner', 'selftest.intern', args);
	}
};

if (args[0] in modes) {
	mode = args.shift();
}

modes[mode]();

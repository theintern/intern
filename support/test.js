var args = process.argv.slice(2);
var spawn = require('child_process').spawnSync;
var path = require('path');
var tsconfig = require('../tsconfig.json');
var buildDir = tsconfig.compilerOptions.outDir;
var mode = 'local';

function run(runner, config, userArgs) {
	var args = [ 'node_modules/intern/' + runner ].concat(userArgs);

	var hasConfig = userArgs.some(function (arg) {
		return arg.indexOf('config=') === 0;
	});
	if (!hasConfig) {
		args.push('config=' + path.join(buildDir, 'tests', config + '.js'));
	}

	spawn('node', args, { stdio: 'inherit' });
}

var modes = {
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

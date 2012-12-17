/*jshint node:true */
define([], function () {
	var rawArgs,

		/**
		 * A hash map of arguments passed to the application. This code expects that arguments are passed
		 */
		args = {};

	if (typeof location !== 'undefined') {
		rawArgs = location.search.replace(/^\?/, '').split('&');
	}
	else if (typeof process !== 'undefined') {
		rawArgs = process.argv.slice(2);
	}
	else {
		throw new Error('Unsupported host environment');
	}

	rawArgs.forEach(function (arg) {
		arg = arg.split('=');
		arg[0] = arg[0].replace(/^--?/, '');

		// Support boolean flags
		if (arg.length < 2) {
			arg[1] = true;
		}

		// Support multiple arguments with the same name
		if (arg[0] in args) {
			if (!Array.isArray(args[arg[0]])) {
				args[arg[0]] = [ args[arg[0]] ];
			}

			args[arg[0]].push(arg[1]);
		}
		else {
			args[arg[0]] = arg[1];
		}
	});

	return args;
});
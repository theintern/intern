/*jshint node:true */
define([], function () {
	var rawArgs,

		/**
		 * A hash map of arguments passed to the application. This code expects that arguments are passed as key=value
		 * pairs, either in the query string (if in browser) or on the command line (if in Node.js). Arguments passed
		 * with a key but no value are assumed to be boolean flags. Keys with - or -- prefixes will have the prefix
		 * stripped.
		 */
		args = {},

		decode = function (string) { return string; };

	if (typeof location !== 'undefined') {
		rawArgs = location.search.replace(/^\?/, '').split('&');
		decode = function (string) {
			// Boolean properties should not be coerced into strings, but will be if they are passed to
			// decodeURIComponent
			if (typeof string === 'boolean') {
				return string;
			}

			return decodeURIComponent(string);
		};
	}
	else /* istanbul ignore else */ if (typeof process !== 'undefined') {
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

			args[arg[0]].push(decode(arg[1]));
		}
		else {
			args[arg[0]] = decode(arg[1]);
		}
	});

	return args;
});

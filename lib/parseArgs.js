define([], function () {
	function parseArguments(rawArgs, decode) {
		var args = {};
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
	}

	return {
		fromCommandLine: function (rawArgs) {
			/* globals process */
			return parseArguments(rawArgs || process.argv.slice(2), function (string) {
				return string;
			});
		},
		fromQueryString: function (query) {
			return parseArguments(query.replace(/^\?/, '').split('&'), function (string) {
				// Boolean properties should not be coerced into strings, but will be if they are passed to
				// decodeURIComponent
				if (typeof string === 'boolean') {
					return string;
				}

				return decodeURIComponent(string);
			});
		}
	};
});

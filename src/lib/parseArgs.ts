function parseArguments(rawArgs: string[], decode: (string: string) => any): { [name: string]: any; } {
	const args: { [key: string]: any; } = {};
	rawArgs.forEach(function (arg) {
		const pair: string[] = arg.split('=');

		const key = pair[0].replace(/^--?/, '');
		let value: any;

		// Support boolean flags
		if (pair.length < 2) {
			value = true;
		}
		else {
			value = decode(arg[1]);

			// Support JSON-encoded properties for reporter configuration
			if (value.charAt(0) === '{') {
				value = JSON.parse(value);
			}
			else if (value.slice(0, 2) === '\\{') {
				value = value.slice(1);
			}
		}

		// Support multiple arguments with the same name
		if (key in args) {
			if (!Array.isArray(args[key])) {
				args[key] = [ args[key] ];
			}

			args[key].push(value);
		}
		else {
			args[key] = value;
		}
	});

	return args;
}

export function fromCommandLine(rawArgs: string[]) {
	return parseArguments(rawArgs || process.argv.slice(2), function (string: string): any {
		return string;
	});
}

export function fromQueryString(query: string) {
	return parseArguments(query.replace(/^\?/, '').split('&'), function (string: string): any {
		// Boolean properties should not be coerced into strings, but will be if they are passed to
		// decodeURIComponent
		if (typeof string === 'boolean') {
			return string;
		}

		return decodeURIComponent(string);
	});
}

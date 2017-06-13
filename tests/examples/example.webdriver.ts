// Import the proper executor for the current environment
import WebDriver from '../src/lib/executors/WebDriver';

const browser = 'firefox';
const debug = process.env['INTERN_DEBUG'] != null;

WebDriver.initialize({
	contactTimeout: 60000,
	debug,
	environments: [ { browserName: browser } ],
	excludeInstrumentation: /(?:node_modules|browser|tests)\//,
	filterErrorStack: true,
	name: 'Test config',
	socketPort: 9001,
	tunnel: 'selenium' as 'selenium',
	tunnelOptions: { drivers: [ browser ] },

	runner: 'dojo',
	runnerConfig: {
		packages: [
			{ name: 'tests', location: '_build/tests' },
			{ name: 'src', location: '_build/src' }
		]
	},

	suites: ['tests/unit/lib/EnvironmentType.js']
});

// For instrumentation to work in Node, any modules that should be instrumented
// must be loaded *after* the Node executor is instantiated.
require('./functional/lib/ProxiedSession');

if (debug) {
	intern.on('log', message => {
		process.stderr.write(`DEBUG: ${message}\n`);
	});
}

intern.run();

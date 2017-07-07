import intern from 'src/index';

// Construct a new executor, assigning it to a global
intern.configure({
	name: 'Test config',
	filterErrorStack: true,
	reporters: 'runner',
	browser: {
		loader: {
			script: 'dojo2',
			options: {
				packages: [ { name: 'src', location: '_build/src' } ]
			}
		}
	},
	suites: '_tests/tests/unit/lib/Environment.js',
	functionalSuites: '_tests/tests/functional/lib/ProxiedSession.js',
	tunnel: 'selenium',
	environments: { browserName: 'chrome', fixSessionCapabilities: 'no-detect' }
});

intern.run();

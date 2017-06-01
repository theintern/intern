/**
 * This is the browser runner for end users. It simply loads and initializes a Browser executor.
 */
import Browser from '../lib/executors/Browser';
import Html from '../lib/reporters/Html';
import Console from '../lib/reporters/Console';
import { getConfig } from '../lib/browser/util';
import { getConfigDescription } from '../lib/common/util';

// A Benchmark global needs to be defined for benchmark.js to work properly when loaded as part of the Intern browser
// bundle since neither Node's require nor an AMD define will be present.
(<any>window).Benchmark = {};

getConfig().then(config => {
	if (config.showConfigs) {
		console.log(getConfigDescription(config));
	}
	else {
		if (!config.reporters) {
			config.reporters = ['html', 'console'];
		}

		if (config.reporters.indexOf('html') === -1) {
			config.reporters.push('html');
		}
		if (config.reporters.indexOf('console') === -1) {
			config.reporters.push('console');
		}

		if (!config.internPath) {
			config.internPath = location.pathname;
		}

		Browser.initialize(config);

		intern.registerReporter('html', Html);
		intern.registerReporter('console', Console);

		// Intern automatically reports run errors, so discard one if we get it
		return intern.run().catch(_error => {});
	}
}).catch(error => {
	if (typeof intern === 'undefined') {
		console.error('Error initializing Intern:', error);
	}
	else {
		return intern.emit('error', error);
	}
});

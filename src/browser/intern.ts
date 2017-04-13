/**
 * This is the browser runner for end users. It simply loads and initializes a Browser executor.
 */
import Browser from '../lib/executors/Browser';
import Html from '../lib/reporters/Html';
import Console from '../lib/reporters/Console';
import { getConfig } from '../lib/browser/util';

getConfig().then(config => {
	if (!config.reporters) {
		config.reporters = ['html'];
	}
	else if (config.reporters.indexOf('html') === -1) {
		config.reporters.push('html');
	}

	if (!config.internPath) {
		config.internPath = location.pathname;
	}

	Browser.initialize(config);

	intern.registerReporter('html', Html);
	intern.registerReporter('console', Console);

	// Intern automatically reports run errors, so discard one if we get it
	return intern.run().catch(_error => {});
}).catch(error => {
	if (typeof intern === 'undefined') {
		console.error('Error initializing Intern:', error);
	}
	else {
		return intern.emit('error', error);
	}
});

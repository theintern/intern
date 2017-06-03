// This is the built-in runner script used to start Intern in a Node environment.

import intern from '../index';
import runner from '../lib/node/runner';
import { getConfig } from '../lib/node/util';
import { getConfigDescription } from '../lib/common/util';

getConfig().then(config => {
	if (config.showConfigs) {
		console.log(getConfigDescription(config));
	}
	else {
		return runner(config);
	}
}).catch(error => {
	// If intern wasn't initialized, then this error won't have been reported
	if (typeof intern() === 'undefined') {
		console.error(error);
	}
	process.exitCode = 1;
});

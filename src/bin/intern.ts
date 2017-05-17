#!/usr/bin/env node

/**
 * This is the built-in runner script used to start Intern in a Node environment.
 */

import runner from '../lib/node/runner';
import { getConfig } from '../lib/node/util';

getConfig().then(runner).catch(error => {
	// If intern wasn't initialized, then this error won't have been reported
	if (typeof intern === 'undefined') {
		console.error(error);
	}
	process.exitCode = 1;
});

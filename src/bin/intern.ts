#!/usr/bin/env node

/**
 * This is the built-in runner script used to start Intern in a Node environment.
 */

import { install } from 'source-map-support';
import runner from '../lib/node/runner';
import { getConfig } from '../lib/node/util';

// TODO: remove <any> when @types/source-map-support is updated
install(<any>{
	handleUncaughtExceptions: false,
	environment: 'node'
});

getConfig().then(runner).catch(error => {
	// If intern wasn't initialized, then this error won't have been reported
	if (typeof intern === 'undefined') {
		console.error(error);
	}
	process.exitCode = 1;
});

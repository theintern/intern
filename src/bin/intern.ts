// This is the built-in runner script used to start Intern in a Node environment.

import Node from '../lib/executors/Node';
import global from '@dojo/core/global';
import { getConfig } from '../lib/node/util';
import { getConfigDescription } from '../lib/common/util';

let intern: Node;

getConfig().then(config => {
	if (config.showConfigs) {
		console.log(getConfigDescription(config));
	}
	else {
		intern = global.intern = new Node();
		intern.configure(<any>{ 'reporters+': 'runner' });
		intern.configure(config);
		return intern.run();
	}
}).catch(error => {
	// If intern wasn't initialized, then this error won't have been reported
	if (intern == null) {
		console.error(error);
	}
	global.process.exitCode = 1;
});

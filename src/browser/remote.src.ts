import Browser from '../lib/executors/Browser';
import { RemoteConfig } from '../lib/RemoteSuite';
import { parseQuery } from '../lib/browser/util';
import { parseArgs } from '../lib/common/util';
import Channel from '../lib/Channel';
import global from '@dojo/shim/global';

// A Benchmark global needs to be defined for benchmark.js to work properly when loaded as part of the Intern browser
// bundle since neither Node's require nor an AMD define will be present.
global.Benchmark = {};

const config = <RemoteConfig>parseArgs(parseQuery());
const channel = new Channel({
	url: config.serverUrl,
	sessionId: config.sessionId,
	port: config.socketPort
});

function displayMessage(message: string) {
	const pre = document.createElement('pre');
	pre.textContent = message;
	document.body.appendChild(pre);
	window.scrollTo(0, pre.offsetTop);
}

try {
	const intern = global.intern = new Browser(config);

	// Forward all executor events back to the Intern host
	intern.on('*', ({ name, data }) => {
		let promise = channel.sendMessage(name, data).catch(error => {
			displayMessage(`Error sending ${name}: ${error.message}`);
			console.error(error);
		});

		// If config.runInSync is true, return the message promise so that Intern will wait for acknowledgement before
		// continuing testing
		if (config.runInSync) {
			return promise;
		}
	});

	channel.sendMessage('remoteStatus', 'initialized');
	// Intern will be further configured and started via an execute command from RemoteSuite
}
catch (error) {
	displayMessage(error.message);
	channel.sendMessage('error', error);
}

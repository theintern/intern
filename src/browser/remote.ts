import Remote from '../lib/executors/Remote';
import { parseQuery } from '../lib/browser/util';
import { parseArgs } from '../lib/common/util';
import Channel from '../lib/WebSocketChannel';

const config = parseArgs(parseQuery());
const channel = new Channel({
	url: config.basePath,
	sessionId: config.sessionId,
	port: config.socketPort
});

try {
	Remote.initialize(config);

	// Forward all executor events back to the Intern host
	intern.on('*', ({ name, data }) => {
		let promise = channel.sendMessage(name, data).catch(console.error);
		if (config.runInSync) {
			return promise;
		}
	});

	// Intern will be further configured and started via an execute command from RemoteSuite
}
catch (error) {
	channel.sendMessage('error', error);
}

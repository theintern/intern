import request = require('dojo/has!host-browser?dojo/request');
import Promise = require('dojo/Promise');

// Send a message, or schedule it to be sent. Return a promise that resolves when the message has been sent.
function sendRequest(url: string) {
	// Send all buffered messages and empty the buffer. Note that the posted data will always be an array of
	// objects.
	function send() {
		// Some testing services have problems handling large message POSTs, so limit the maximum size of
		// each POST body to maxPostSize bytes. Always send at least one message, even if it's more than
		// maxPostSize bytes.
		function sendNextBlock(): Promise<any> {
			const block = [ messages.shift() ];
			let size = block[0].length;
			while (messages.length > 0 && size + messages[0].length < maxPostSize) {
				size += messages[0].length;
				block.push(messages.shift());
			}

			return request.post(url, {
				headers: { 'Content-Type': 'application/json' },
				data: JSON.stringify(block)
			}).then(function () {
				if (messages.length > 0) {
					return sendNextBlock();
				}
			});
		}

		const messages = messageBuffer;
		messageBuffer = [];

		activeRequest = new Promise(function (resolve, reject) {
			return sendNextBlock().then(function () {
				activeRequest = null;
				resolve();
			}).catch(function (error) {
				activeRequest = null;
				reject(error);
			});
		});

		return activeRequest;
	}

	if (activeRequest || pendingRequest) {
		if (!pendingRequest) {
			// Schedule another request after the active one completes
			pendingRequest = activeRequest.then(function () {
				pendingRequest = null;
				return send();
			});
		}
		return pendingRequest;
	}
	else {
		return send();
	}
}

let activeRequest: Promise<any>;
let maxPostSize = 50000;
let messageBuffer: string[] = [];
let pendingRequest: Promise<any>;
let sequence = 0;

export function getSequence() {
	return sequence;
};

export function setSequence(_sequence: number) {
	sequence = _sequence;
};

export function setMaxPostSize(_maxPostSize: number) {
	maxPostSize = _maxPostSize;
};

export function send(url: string, data: any, sessionId: string) {
	data = data.map(function (item: any) {
		return item instanceof Error ?
			{ name: item.name, message: item.message, stack: item.stack } : item;
	});

	messageBuffer.push(JSON.stringify({
		sequence: sequence,
		// Although sessionId may be passed as part of the payload, it is passed in the message object as well to
		// allow the conduit to be fully separate and encapsulated from the rest of the code
		sessionId: sessionId,
		payload: data
	}));

	// The sequence must not be incremented until after the data is successfully serialised, since an error
	// during serialisation might occur, which would mean the request is never sent, which would mean the
	// dispatcher on the server-side will stall because the sequence numbering will be wrong
	sequence++;

	return sendRequest(url);
};

import { InternRequestHandler } from '../Server';
import { Message } from '../channels/Base';

export default function post(): InternRequestHandler {
	return (request, response, next) => {
		if (request.method !== 'POST') {
			return next();
		}

		const { executor, handleMessage } = request.intern;

		try {
			let rawMessages: any = request.body;

			if (!Array.isArray(rawMessages)) {
				rawMessages = [rawMessages];
			}

			const messages: Message[] = rawMessages.map(function (messageString: string) {
				return JSON.parse(messageString);
			});

			executor.log('Received HTTP messages');

			Promise.all(messages.map(message => handleMessage(message)))
				.then(() => {
					response.statusCode = 204;
					response.end();
				})
				.catch(() => {
					response.statusCode = 500;
					response.end();
				})
			;
		}
		catch (_) {
			response.statusCode = 500;
			response.end();
		}
	};
}

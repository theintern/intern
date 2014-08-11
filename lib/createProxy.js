/*jshint node:true */
define([
	'require',
	'dojo/node!http',
	'dojo/node!path',
	'dojo/node!fs',
	'dojo/topic',
	'dojo/aspect',
	'./util'
], function (require, http, path, fs, topic, aspect, util) {
	// TODO: This is some insanely bad code that makes insanely bad assumptions, wastes insane amounts of memory,
	// and violates the HTTP spec like crazy. But as a prototype, it works.

	var contentTypes = {
		'': 'application/octet-stream',
		'.css': 'text/css',
		'.gif': 'image/gif',
		'.html': 'text/html',
		'.jpg': 'image/jpeg',
		'.js': 'text/javascript',
		'.json': 'application/json',
		'.png': 'image/png'
	};

	return function (config) {
		var sessions = {};

		function publishInSequence(message) {
			var session = sessions[message.sessionId];
			if (!session) {
				session = sessions[message.sessionId] = { lastSequence: -1, queue: {} };
			}

			if (message.sequence <= session.lastSequence) {
				throw new Error('Repeated sequence for session ' + message.sessionId + ': ' + session.lastSequence +
					' last ' + message.sequence + ' cur');
			}

			if (message.sequence > session.lastSequence + 1) {
				session.queue[message.sequence] = message;
				return;
			}

			do {
				session.lastSequence = message.sequence;
				delete session.queue[session.lastSequence];

				topic.publish.apply(topic, message.payload);
			}
			while ((message = session.queue[message.sequence + 1]));
		}

		function handler(request, response) {
			if (request.method === 'GET') {
				if (/\.js(?:$|\?)/.test(request.url)) {
					handleFile(request, response, config.instrument);
				}
				else {
					handleFile(request, response);
				}
			}
			else if (request.method === 'POST') {
				request.setEncoding('utf8');
				var data = '';
				request.on('data', function (chunk) {
					data += chunk;
				});
				request.on('end', function () {
					publishInSequence(JSON.parse(data));

					response.statusCode = 204;
					response.end();
				});
			}
			else {
				response.statusCode = 501;
				response.end();
			}
		}

		function handleFile(request, response, instrument) {
			var file = /^\/+([^?]*)/.exec(request.url)[1],
				wholePath;

			if (/^__intern\//.test(file)) {
				wholePath = path.join(require.toUrl('intern/'), file.replace(/^__intern\//, ''));
				instrument = false;
			}
			else {
				wholePath = path.join(config.basePath, file);
			}

			if (wholePath.charAt(wholePath.length - 1) === '/') {
				wholePath += 'index.html';
			}

			// if the string passed to `excludeInstrumentation` changes here, it must also change in `client.js`
			if (config.excludeInstrumentation && config.excludeInstrumentation.test(file)) {
				instrument = false;
			}

			var contentType = contentTypes[path.extname(wholePath)] || contentTypes[''];
			if (instrument) {
				fs.readFile(wholePath, 'utf8', function (error, data) {
					if (error) {
						send404(response);
						return;
					}

					// providing `wholePath` to the instrumenter instead of a partial filename is necessary because
					// lcov.info requires full path names as per the lcov spec
					data = util.instrument(data.toString('utf-8'), wholePath);

					response.writeHead(200, {
						'Content-Type': contentType,
						'Content-Length': Buffer.byteLength(data)
					});
					response.end(data);
				});
			}
			else {
				fs.stat(wholePath, function (error, status) {
					if (error) {
						send404(response);
						return;
					}

					response.writeHead(200, {
						'Content-Type': contentType,
						'Content-Length': status.size
					});

					fs.createReadStream(wholePath).pipe(response);
				});
			}
		}

		function send404(response) {
			response.writeHead(404, {
				'Content-Type': 'text/html;charset=utf-8'
			});
			response.end('<!DOCTYPE html><title>404 Not Found</title><h1>404 Not Found</h1><!-- ' +
				new Array(512).join('.') + ' -->');
		}

		var server = http.createServer(handler);
		server.listen(config.port);

		var sockets = [];

		aspect.after(server, 'close', function () {
			var socket;
			while ((socket = sockets.pop())) {
				socket.destroy();
			}

			topic.publish('/proxy/stop', config);
		});

		server.on('connection', function (socket) {
			sockets.push(socket);
			socket.setNoDelay(true);
			socket.on('close', function () {
				var index = sockets.indexOf(socket);
				index !== -1 && sockets.splice(index, 1);
			});
		});

		topic.publish('/proxy/start', config);
		return server;
	};
});

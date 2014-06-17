/*jshint node:true */
define([
	'require',
	'dojo/node!http',
	'dojo/node!path',
	'dojo/node!fs',
	'dojo/topic',
	'dojo/aspect'
], function (require, http, path, fs, topic, aspect) {
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
					handleFile(request, response, config.instrumenter);
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

		function handleFile(request, response, instrumenter) {
			var file = /^\/+([^?]*)/.exec(request.url)[1],
				wholePath;

			if (/^__intern\//.test(file)) {
				wholePath = path.join(require.toUrl('intern/'), file.replace(/^__intern\//, ''));
				instrumenter = null;
			}
			else {
				wholePath = path.join(config.basePath, file);
			}

			if (wholePath.charAt(wholePath.length - 1) === '/') {
				wholePath += 'index.html';
			}

			// if the string passed to `excludeInstrumentation` changes here, it must also change in `client.js`
			if (config.excludeInstrumentation && config.excludeInstrumentation.test(file)) {
				instrumenter = null;
			}

			var contentType = contentTypes[path.extname(wholePath)] || contentTypes[''];
			if (instrumenter) {
				fs.readFile(wholePath, 'utf8', function (error, data) {
					if (error) {
						response.statusCode = 404;
						response.end();
						return;
					}

					// providing `wholePath` to the instrumenter instead of a partial filename is necessary because
					// lcov.info requires full path names as per the lcov spec
					data = instrumenter.instrumentSync(data, wholePath);

					response.writeHead(200, {
						'Content-Type': contentType,
						'Content-Length': Buffer.byteLength(data)
					});
					response.end(data);
				});
			}
			else {
				fs.stat(wholePath, function (err, stat) {
					if (err) {
						response.statusCode = 404;
						response.end();
						return;
					}

					response.writeHead(200, {
						'Content-Type': contentType,
						'Content-Length': stat.size
					});
					var fileStream = fs.createReadStream(wholePath);
					fileStream.pipe(response);
				});
			}
		}

		var server = http.createServer(handler);
		server.listen(config.port);

		var sockets = [];

		aspect.after(server, 'close', function () {
			var socket;
			while ((socket = sockets.pop())) {
				socket.destroy();
			}
		});

		server.on('connection', function (socket) {
			sockets.push(socket);
			socket.on('close', function () {
				var index = sockets.indexOf(socket);
				index !== -1 && sockets.splice(index, 1);
			});
		});

		console.log('Listening on 0.0.0.0:' + config.port);
		return server;
	};
});

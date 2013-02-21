/*jshint node:true */
define([
	'require',
	'dojo-ts/node!http',
	'dojo-ts/node!path',
	'dojo-ts/node!fs',
	'dojo-ts/node!zlib',
	'dojo-ts/topic'
], function (require, http, path, fs, zlib, topic) {
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

	return function (port, instrumenter, root) {
		var sessions = {};

		function publishInSequence(message) {
			var session = sessions[message.sessionId];
			if (!session) {
				session = sessions[message.sessionId] = { lastSequence: -1, queue: {} };
			}

			if (message.sequence <= session.lastSequence) {
				throw new Error('Repeated sequence for session ' + message.sessionId);
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
					handleFile(request, response, instrumenter);
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

			if (/^__teststack\//.test(file)) {
				wholePath = path.join(require.toUrl('teststack'), file.replace(/^__teststack\//, ''));
				instrumenter = null;
			}
			else {
				wholePath = path.join(root, file);
			}

			var contentType = contentTypes[path.extname(wholePath)] || contentTypes[''];
			if (instrumenter) {
				fs.readFile(wholePath, 'utf8', function (error, data) {
					if (error) {
						response.statusCode = 404;
						response.end();
						return;
					}

					zlib.gzip(instrumenter.instrumentSync(data, file), function (error, data) {
						if (error) {
							console.error(error);
							response.statusCode = 500;
							response.end();
							throw error;
						}

						response.writeHead(200, {
							'Content-Type': contentType,
							'Content-Encoding': 'gzip'
						});
						response.end(data);
					});
				});
			}
			else {
				fs.exists(wholePath, function (exists) {
					if (!exists) {
						response.statusCode = 404;
						response.end();
						return;
					}

					response.writeHead(200, {
						'Content-Type': contentType
					});
					var fileStream = fs.createReadStream(wholePath);
					fileStream.pipe(response);
				});
			}
		}

		var server = http.createServer(handler);
		server.listen(port);
		console.log('Listening on 0.0.0.0:' + port);
		return server;
	};
});
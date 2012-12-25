define([
	'dojo/node!http',
	'dojo/node!path',
	'dojo/node!fs',
	'dojo/node!zlib'
], function (http, path, fs, zlib) {
	// TODO: This is some insanely bad code that makes insanely bad assumptions, wastes insane amounts of memory,
	// and violates the HTTP spec like crazy. But as a prototype, it works.

	return function (port, instrumenter, root) {
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
				// TODO: Receive pub/sub results
				response.statusCode = 405;
				response.end();
			}
		}

		function handleFile(request, response, instrumenter) {
			var file = /^\/([^?]*)/.exec(request.url)[1],
				wholePath = path.resolve(root, file);

			fs.readFile(wholePath, 'utf8', function (error, data) {
				if (error) {
					response.statusCode = 404;
					response.end();
					return;
				}

				if (instrumenter) {
					zlib.gzip(instrumenter.instrumentSync(data, file), function (error, data) {
						if (error) {
							console.error(error);
							response.statusCode = 500;
							response.end();
							throw error;
						}

						response.writeHead(200, { 'Content-Encoding': 'gzip' });
						response.end(data);
					});
				}
				else {
					response.end(data, 'utf8');
				}
			});
		}

		var server = http.createServer(handler);
		server.listen(port);
		console.log('Listening on 0.0.0.0:' + port);
		return server;
	};
});
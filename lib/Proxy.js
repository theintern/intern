define([
	'require',
	'dojo/lang',
	'dojo/Promise',
	'dojo/node!http',
	'dojo/node!path',
	'dojo/node!fs',
	'dojo/aspect',
	'./util'
], function (require, lang, Promise, http, path, fs, aspect, util) {
	/* jshint node:true */

	function Proxy(config) {
		this.contentTypes = {
			'': 'application/octet-stream',
			'.css': 'text/css',
			'.gif': 'image/gif',
			'.html': 'text/html',
			'.jpg': 'image/jpeg',
			'.js': 'text/javascript',
			'.json': 'application/json',
			'.png': 'image/png'
		};

		this.sessions = {};
		this.reporterManager = config.reporterManager;
		this.config = config;
	}

	Proxy.prototype = {
		constructor: Proxy,
		publishInSequence: function (message) {
			var session = this.sessions[message.sessionId];
			if (!session) {
				session = this.sessions[message.sessionId] = { lastSequence: -1, queue: {} };
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
				this.reporterManager.emit.apply(this.reporterManager, message.payload);
			} while ((message = session.queue[message.sequence + 1]));
		},

		handler: function (request, response) {
			if (request.method === 'GET') {
				if (/\.js(?:$|\?)/.test(request.url)) {
					this.handleFile(request, response, this.config.instrument);
				}
				else {
					this.handleFile(request, response);
				}
			}
			else if (request.method === 'POST') {
				request.setEncoding('utf8');

				var data = '';
				request.on('data', function (chunk) {
					data += chunk;
				});

				var self = this;
				request.on('end', function () {
					self.publishInSequence(JSON.parse(data));
					response.statusCode = 204;
					response.end();
				});
			}
			else {
				response.statusCode = 501;
				response.end();
			}
		},

		handleFile: function (request, response, instrument) {
			var file = /^\/+([^?]*)/.exec(request.url)[1];
			var wholePath;
			var self = this;

			if (/^__intern\//.test(file)) {
				wholePath = path.join(require.toUrl('intern/'), file.replace(/^__intern\//, ''));
				instrument = false;
			}
			else {
				wholePath = path.join(this.config.basePath, file);
			}

			if (wholePath.charAt(wholePath.length - 1) === '/') {
				wholePath += 'index.html';
			}

			// if the string passed to `excludeInstrumentation` changes here, it must also change in `client.js`
			if (this.config.excludeInstrumentation && this.config.excludeInstrumentation.test(file)) {
				instrument = false;
			}

			var contentType = this.contentTypes[path.extname(wholePath)] || this.contentTypes[''];
			if (instrument) {
				fs.readFile(wholePath, 'utf8', function (error, data) {
					if (error) {
						self.send404(response);
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
						self.send404(response);
						return;
					}

					response.writeHead(200, {
						'Content-Type': contentType,
						'Content-Length': status.size
					});

					fs.createReadStream(wholePath).pipe(response);
				});
			}
		},

		send404: function (response) {
			response.writeHead(404, {
				'Content-Type': 'text/html;charset=utf-8'
			});
			response.end('<!DOCTYPE html><title>404 Not Found</title><h1>404 Not Found</h1><!-- ' +
				new Array(512).join('.') + ' -->');
		},

		start: function () {
			var server = this.server = http.createServer(lang.bind(this, 'handler'));
			server.listen(this.config.port);

			var sockets = [];
			var self = this;

			var closeDfd = this.closeDfd = new Promise.Deferred();
			aspect.after(server, 'close', function () {
				var socket;
				while ((socket = sockets.pop())) {
					socket.destroy();
				}
				self.reporterManager.emit('proxyEnd', self.config).finally(function () {
					closeDfd.resolve();
				});
			});

			server.on('connection', function (socket) {
				sockets.push(socket);
				socket.setNoDelay(true);
				socket.on('close', function () {
					var index = sockets.indexOf(socket);
					index !== -1 && sockets.splice(index, 1);
				});
			});

			return this.reporterManager.emit('proxyStart', this.config);
		},

		stop: function () {
			this.server && this.server.close();
			this.server = null;
			return this.closeDfd.promise;
		}
	};

	return Proxy;
});

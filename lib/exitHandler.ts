import Promise = require('dojo/Promise');

export default function (process: NodeJS.Process, task: Promise<number>, timeout: number): void {
	let cancelled = false;

	process.on('SIGINT', (function () {
		let hurry = false;
		return function () {
			cancelled = true;

			if (hurry) {
				console.warn('\nShutting down immediately. You monster');
				process.exit(1);
			}

			hurry = true;
			const reason = new Error('SIGINT received');
			reason.name = 'CancelError';
			console.warn('\nShutting down gracefully; please wait or hit CTRL+C again to quit immediately');
			task.cancel(reason);
		};
	})());

	task.then(function (numFailedTests) {
		process.once('exit', function () {
			process.exit(cancelled || numFailedTests ? 1 : 0);
		});
	},
	function () {
		process.once('exit', function () {
			process.exit(2);
		});
	})
	.finally(function () {
		const ref = setTimeout(function () {
			console.warn('Node.js hang detected; make sure to close all sockets, timers, and ' +
				'servers you opened during testing!');
			process.exit();
		}, timeout);
		ref.unref();
	});
};

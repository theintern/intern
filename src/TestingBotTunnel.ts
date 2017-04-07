import Tunnel, { TunnelProperties, ChildExecutor, NormalizedEnvironment, StatusEvent } from './Tunnel';
import { watchFile, unwatchFile } from 'fs';
import UrlSearchParams from '@dojo/core/UrlSearchParams';
import { tmpdir } from 'os';
import { join } from 'path';
import request from '@dojo/core/request';
import { NodeRequestOptions } from '@dojo/core/request/providers/node';
import { parse } from 'url';
import { fileExists, on } from './util';
import { mixin } from '@dojo/core/lang';
import { JobState } from './interfaces';
import Task from '@dojo/core/async/Task';

/**
 * A TestingBot tunnel.
 *
 * The username and accessKey properties will be initialized using TESTINGBOT_API_KEY and TESTINGBOT_API_SECRET.
 */
export default class TestingBotTunnel extends Tunnel implements TunnelProperties {
	/**
	 * A list of regular expressions corresponding to domains whose connections should fail immediately if the VM
	 * attempts to make a connection to them.
	 */
	fastFailDomains: string[];

	/** A filename where additional logs from the tunnel should be output. */
	logFile: string;

	/** Whether or not to use rabbIT compression for the tunnel connection. */
	useCompression: boolean;

	/** Whether or not to use the default local Jetty proxy for the tunnel. */
	useJettyProxy: boolean;

	/** Whether or not to use the default remote Squid proxy for the VM. */
	useSquidProxy: boolean;

	/** Whether or not to re-encrypt data encrypted by self-signed certificates. */
	useSsl: boolean;

	constructor(options?: TestingBotOptions) {
		super(mixin({
			username: process.env.TESTINGBOT_KEY,
			accessKey: process.env.TESTINGBOT_SECRET,
			directory: join(__dirname, 'testingbot'),
			environmentUrl: 'https://api.testingbot.com/v1/browsers',
			executable: 'java',
			fastFailDomains: [],
			logFile: null,
			port: 4445,
			url: 'https://testingbot.com/downloads/testingbot-tunnel.zip',
			useCompression: false,
			useJettyProxy: true,
			useSquidProxy: true,
			useSsl: false
		}, options));
	}

	get auth() {
		return `${this.username || ''}:${this.accessKey || ''}`;
	}

	get isDownloaded() {
		return fileExists(join(this.directory, 'testingbot-tunnel/testingbot-tunnel.jar'));
	}

	protected _makeArgs(readyFile: string): string[] {
		const args = [
			'-jar', join(this.directory, 'testingbot-tunnel', 'testingbot-tunnel.jar'),
			this.username,
			this.accessKey,
			'-P', this.port,
			'-f', readyFile
		];

		this.fastFailDomains.length && args.push('-F', this.fastFailDomains.join(','));
		this.logFile && args.push('-l', this.logFile);
		this.useJettyProxy || args.push('-x');
		this.useSquidProxy || args.push('-q');
		this.useCompression && args.push('-b');
		this.useSsl && args.push('-s');
		this.verbose && args.push('-d');

		if (this.proxy) {
			const proxy = parse(this.proxy);

			proxy.hostname && args.unshift('-Dhttp.proxyHost=', proxy.hostname);
			proxy.port && args.unshift('-Dhttp.proxyPort=', proxy.port);
		}

		return args;
	}

	sendJobState(jobId: string, data: JobState): Task<void> {
		const params = new UrlSearchParams();

		data.success != null && params.set('test[success]', String(data.success ? 1 : 0));
		data.status && params.set('test[status_message]', data.status);
		data.name && params.set('test[name]', data.name);
		data.extra && params.set('test[extra]', JSON.stringify(data.extra));
		data.tags && data.tags.length && params.set('groups', data.tags.join(','));

		const url = `https://api.testingbot.com/v1/tests/${jobId}`;
		const payload = params.toString();
		return <Task<any>> request.put(url, <NodeRequestOptions> {
			body: payload,
			headers: {
				'Content-Length': String(Buffer.byteLength(payload, 'utf8')),
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			password: this.accessKey,
			user: this.username,
			proxy: this.proxy
		}).then(function (response) {
			return response.text().then(text => {
				if (text) {
					const data = JSON.parse(text);

					if (data.error) {
						throw new Error(data.error);
					}
					else if (!data.success) {
						throw new Error('Job data failed to save.');
					}
					else if (response.status !== 200) {
						throw new Error(`Server reported ${response.status} with: ${text}`);
					}
				}
				else {
					throw new Error(`Server reported ${response.status} with no other data.`);
				}
			});
		});
	}

	protected _start(executor: ChildExecutor) {
		const readyFile = join(tmpdir(), 'testingbot-' + Date.now());

		return this._makeChild((child, resolve, reject) => {
			// Polling API is used because we are only watching for one file, so efficiency is not a big deal, and the
			// `fs.watch` API has extra restrictions which are best avoided
			watchFile(readyFile, { persistent: false, interval: 1007 }, function (current, previous) {
				if (Number(current.mtime) === Number(previous.mtime)) {
					// readyFile hasn't been modified, so ignore the event
					return;
				}

				unwatchFile(readyFile);
				resolve();
			});

			let lastMessage: string;
			this._handle = on(child.stderr, 'data', (data: string) => {
				data = String(data);
				data.split('\n').forEach((message) => {
					if (message.indexOf('INFO: ') === 0) {
						message = message.slice('INFO: '.length);
						// the tunnel produces a lot of repeating messages during setup when the status is pending;
						// deduplicate them for sanity
						if (
							message !== lastMessage &&
							message.indexOf('>> [') === -1 &&
							message.indexOf('<< [') === -1
						) {
							this.emit<StatusEvent>({
								type: 'status',
								target: this,
								status: message
							});
							lastMessage = message;
						}
					}
					else if (message.indexOf('SEVERE: ') === 0) {
						reject(message);
					}
				});
			});

			executor(child, resolve, reject);
		}, readyFile);
	}

	/**
	 * Attempt to normalize a TestingBot described environment with the standard Selenium capabilities
	 *
	 * TestingBot returns a list of environments that looks like:
	 *
	 * {
	 *     "selenium_name": "Chrome36",
	 *     "name": "googlechrome",
	 *     "platform": "CAPITAN",
	 *     "version":"36"
	 * }
	 *
	 * @param environment a TestingBot environment descriptor
	 * @returns a normalized descriptor
	 */
	protected _normalizeEnvironment(environment: any): NormalizedEnvironment {
		const browserMap: any = {
			googlechrome: 'chrome',
			iexplore: 'internet explorer'
		};

		const platform = environment.platform;
		const browserName = browserMap[environment.name] || environment.name;
		const version = environment.version;

		return {
			platform,
			browserName,
			version,
			descriptor: environment,

			intern: {
				platform,
				browserName,
				version
			}
		};
	}
}

export interface TestingBotProperties extends TunnelProperties {
	fastFailDomains: string[];
	logFile: string;
	useCompression: boolean;
	useJettyProxy: boolean;
	useSquidProxy: boolean;
	useSsl: boolean;
}

export type TestingBotOptions = Partial<TestingBotProperties>;

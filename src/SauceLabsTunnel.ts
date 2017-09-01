import Tunnel, {
	TunnelProperties,
	DownloadOptions,
	ChildExecutor,
	NormalizedEnvironment,
	StatusEvent
} from './Tunnel';
import { JobState } from './interfaces';
import { chmodSync, watchFile, unwatchFile } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Task, { State } from '@dojo/core/async/Task';
import request from '@dojo/core/request';
import { NodeRequestOptions } from '@dojo/core/request/providers/node';
import { format as formatUrl, parse as parseUrl, Url } from 'url';
import { mixin } from '@dojo/core/lang';
import { fileExists, on } from './util';
import Promise from '@dojo/shim/Promise';

const scVersion = '4.4.7';

/**
 * A Sauce Labs tunnel. This tunnel uses Sauce Connect 4 on platforms where it
 * is supported, and Sauce Connect 3 on all other platforms.
 *
 * The accessKey and username properties will be initialized using
 * SAUCE_ACCESS_KEY and SAUCE_USERNAME.
 */
export default class SauceLabsTunnel extends Tunnel
	implements SauceLabsProperties {
	/**
	 * A list of domains that should not be proxied by the tunnel on the remote
	 * VM.
	 */
	directDomains: string[];

	/**
	 * A list of domains that will be proxied by the tunnel on the remote VM.
	 */
	tunnelDomains: string[];

	/**
	 * A list of URLs that require additional HTTP authentication. Only the
	 * hostname, port, and auth are used. This property is only supported by
	 * Sauce Connect 4 tunnels.
	 */
	domainAuthentication: string[];

	/**
	 * A list of regular expressions corresponding to domains whose connections
	 * should fail immediately if the VM attempts to make a connection to them.
	 */
	fastFailDomains: string[];

	/**
	 * Allows the tunnel to also be used by sub-accounts of the user that
	 * started the tunnel.
	 */
	isSharedTunnel: boolean;

	/** A filename where additional logs from the tunnel should be output. */
	logFile: string;

	/** A filename where Sauce Connect stores its process information. */
	pidFile: string;

	/**
	 * Specifies the maximum log filesize before rotation, in bytes. This
	 * property is only supported by Sauce Connect 3 tunnels.
	 */
	logFileSize: number;

	/**
	 * Log statistics about HTTP traffic every `logTrafficStats` milliseconds.
	 * This property is only supported by Sauce Connect 4 tunnels.
	 */
	logTrafficStats: number;

	/**
	 * An alternative URL for the Sauce REST API. This property is only
	 * supported by Sauce Connect 3 tunnels.
	 */
	restUrl: string;

	/**
	 * A list of domains that should not have their SSL connections re-encrypted
	 * when going through the tunnel.
	 */
	skipSslDomains: string[];

	/**
	 * An additional set of options to use with the Squid proxy for the remote
	 * VM. This property is only supported by Sauce Connect 3 tunnels.
	 */
	squidOptions: string;

	/**
	 * Whether or not to use the proxy defined at [[Tunnel.proxy]] for the
	 * tunnel connection itself.
	 */
	useProxyForTunnel: boolean;

	/**
	 * Overrides the version of the VM created on Sauce Labs. This property is
	 * only supported by Sauce Connect 3 tunnels.
	 */
	vmVersion: string;

	scVersion: string;

	constructor(options?: SauceLabsOptions) {
		super(
			mixin(
				{
					accessKey: process.env.SAUCE_ACCESS_KEY,
					directDomains: [],
					directory: join(__dirname, 'saucelabs'),
					domainAuthentication: [],
					environmentUrl:
						'https://saucelabs.com/rest/v1/info/platforms/webdriver',
					fastFailDomains: [],
					isSharedTunnel: false,
					logTrafficStats: 0,
					scVersion,
					skipSslDomains: [],
					tunnelDomains: [],
					useProxyForTunnel: false,
					username: process.env.SAUCE_USERNAME
				},
				options
			)
		);
	}

	get auth() {
		return `${this.username || ''}:${this.accessKey || ''}`;
	}

	get executable() {
		const platform = this.platform === 'darwin' ? 'osx' : this.platform;
		const architecture = this.architecture;

		if (
			platform === 'osx' ||
			platform === 'win32' ||
			(platform === 'linux' && architecture === 'x64')
		) {
			return join(
				this.directory,
				'sc-' +
					this.scVersion +
					'-' +
					platform +
					'/bin/sc' +
					(platform === 'win32' ? '.exe' : '')
			);
		} else {
			return 'java';
		}
	}

	get extraCapabilities() {
		const capabilities: any = {};

		if (this.tunnelId) {
			capabilities['tunnel-identifier'] = this.tunnelId;
		}

		return capabilities;
	}

	get isDownloaded() {
		return fileExists(
			this.executable === 'java'
				? join(this.directory, 'Sauce-Connect.jar')
				: join(this.executable)
		);
	}

	get url() {
		const platform = this.platform === 'darwin' ? 'osx' : this.platform;
		const architecture = this.architecture;
		let url = 'https://saucelabs.com/downloads/sc-' + this.scVersion + '-';

		if (platform === 'osx' || platform === 'win32') {
			url += platform + '.zip';
		} else if (platform === 'linux' && architecture === 'x64') {
			url += platform + '.tar.gz';
		} else {
			// Sauce Connect 3 uses Java so should be able to run on other
			// platforms that Sauce Connect 4 does not support
			url = 'https://saucelabs.com/downloads/Sauce-Connect-3.1-r32.zip';
		}

		return url;
	}

	protected _postDownloadFile(
		data: Buffer,
		options?: DownloadOptions
	): Promise<void> {
		return super._postDownloadFile(data, options).then(() => {
			if (this.executable !== 'java') {
				chmodSync(this.executable, parseInt('0755', 8));
			}
		});
	}

	protected _makeNativeArgs(proxy?: Url): string[] {
		const args = ['-u', this.username, '-k', this.accessKey];

		if (proxy) {
			if (proxy.host) {
				args.push('-p', proxy.host);
			}

			if (proxy.auth) {
				args.push('-w', proxy.auth);
			}
			/*else if (proxy.username) {
				args.push('-w', proxy.username + ':' + proxy.password);
			}*/
		}

		if (this.domainAuthentication.length) {
			this.domainAuthentication.forEach(function(domain) {
				const url = parseUrl(domain);
				args.push('-a', `${url.hostname}:${url.port}:${url.auth}`);
			});
		}

		this.logTrafficStats &&
			args.push('-z', String(Math.floor(this.logTrafficStats / 1000)));
		this.verbose && args.push('-v');

		return args;
	}

	protected _makeJavaArgs(proxy?: Url): string[] {
		const args = [
			'-jar',
			'Sauce-Connect.jar',
			this.username,
			this.accessKey
		];

		this.logFileSize && args.push('-g', String(this.logFileSize));
		this.squidOptions && args.push('-S', this.squidOptions);
		this.verbose && args.push('-d');

		if (proxy) {
			proxy.hostname &&
				args.push(
					'-p',
					proxy.hostname + (proxy.port ? ':' + proxy.port : '')
				);

			if (proxy.auth) {
				const auth = proxy.auth.split(':');
				args.push('-u', auth[0], '-X', auth[1]);
			}
			/*else {
				proxy.username && args.push('-u', proxy.username);
				proxy.password && args.push('-X', proxy.password);
			}*/
		}

		return args;
	}

	protected _makeArgs(readyFile: string): string[] {
		if (!this.username || !this.accessKey) {
			throw new Error(
				'SauceLabsTunnel requires a username and access key'
			);
		}

		const proxy = this.proxy ? parseUrl(this.proxy) : undefined;
		const args =
			this.executable === 'java'
				? this._makeJavaArgs(proxy)
				: this._makeNativeArgs(proxy);

		args.push(
			'-P',
			this.port,
			'-f',
			readyFile,
			// Required for websocket support
			'--vm-version',
			'dev-varnish'
		);

		this.directDomains.length &&
			args.push('-D', this.directDomains.join(','));
		this.tunnelDomains.length &&
			args.push('-t', this.tunnelDomains.join(','));
		this.fastFailDomains.length &&
			args.push('-F', this.fastFailDomains.join(','));
		this.isSharedTunnel && args.push('-s');
		this.logFile && args.push('-l', this.logFile);
		this.pidFile && args.push('--pidfile', this.pidFile);
		this.restUrl && args.push('-x', this.restUrl);
		this.skipSslDomains.length &&
			args.push('-B', this.skipSslDomains.join(','));
		this.tunnelId && args.push('-i', this.tunnelId);
		this.useProxyForTunnel && args.push('-T');
		this.vmVersion && args.push('-V', this.vmVersion);

		return args;
	}

	sendJobState(jobId: string, data: JobState): Task<void> {
		let url = parseUrl(this.restUrl || 'https://saucelabs.com/rest/v1/');
		url.auth = this.username + ':' + this.accessKey;
		url.pathname += this.username + '/jobs/' + jobId;

		const payload = JSON.stringify({
			build: data.buildId,
			'custom-data': data.extra,
			name: data.name,
			passed: data.success,
			public: data.visibility,
			tags: data.tags
		});

		return <Task<any>>request
			.put(formatUrl(url), <NodeRequestOptions>{
				body: payload,
				headers: {
					'Content-Length': String(
						Buffer.byteLength(payload, 'utf8')
					),
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				password: this.accessKey,
				user: this.username,
				proxy: this.proxy
			})
			.then(function(response) {
				return response.text().then(text => {
					if (text) {
						const data = JSON.parse(text);

						if (data.error) {
							throw new Error(data.error);
						}

						if (response.status !== 200) {
							throw new Error(
								`Server reported ${response.status} with: ${text}`
							);
						}
					} else {
						throw new Error(
							`Server reported ${response.status} with no other data.`
						);
					}
				});
			});
	}

	protected _start(executor: ChildExecutor) {
		const readyFile = join(tmpdir(), 'saucelabs-' + Date.now());

		let readMessage: Function;
		let readStartupMessage: (message: string) => boolean;
		let readRunningMessage: (message: string) => void;

		const task = this._makeChild((child, resolve, reject) => {
			readStartupMessage = function(message: string) {
				function fail(message: string) {
					if (task.state === State.Pending) {
						reject(new Error(message));
					}
					return true;
				}

				// These messages contain structured data we can try to consume
				if (message.indexOf('Error: response: ') === 0) {
					try {
						const error = /(\{[\s\S]*\})/.exec(message);
						if (error) {
							const data = JSON.parse(error[1]);
							return fail(data.error);
						}
					} catch (error) {
						// It seems parsing did not work so well; fall through
						// to the normal error handler
					}
				}

				if (message.indexOf('Error: ') === 0) {
					// skip known warnings
					if (
						/open file limit \d+ is too low/.test(message) ||
						/Sauce Labs recommends setting it/.test(message) ||
						/HTTP response code indicated failure/.test(message)
					) {
						return;
					}
					return fail(message.slice('Error: '.length));
				}

				readStatus(message);
			};

			readRunningMessage = function(message: string) {
				// Sauce Connect 3
				if (
					message.indexOf(
						'Problem connecting to Sauce Labs REST API'
					) > -1
				) {
					// It will just keep trying and trying and trying for a
					// while, but it is a failure, so force it to stop
					child.kill('SIGTERM');
				}

				readStatus(message);
			};

			const readStatus = (message: string) => {
				if (
					message &&
					message.indexOf('Please wait for') === -1 &&
					message.indexOf('Sauce Connect is up') === -1 &&
					message.indexOf('Sauce Connect') !== 0 &&
					message.indexOf('Using CA certificate bundle') === -1 &&
					// Sauce Connect 3
					message.indexOf('You may start your tests') === -1
				) {
					this.emit<StatusEvent>({
						type: 'status',
						target: this,
						status: message
					});
				}
			};

			readMessage = readStartupMessage;

			// Polling API is used because we are only watching for one file, so
			// efficiency is not a big deal, and the `fs.watch` API has extra
			// restrictions which are best avoided
			watchFile(
				readyFile,
				{ persistent: false, interval: 1007 },
				function(current, previous) {
					if (Number(current.mtime) === Number(previous.mtime)) {
						// readyFile hasn't been modified, so ignore the event
						return;
					}

					unwatchFile(readyFile);

					// We have to watch for errors until the tunnel has started
					// successfully at which point we only want to watch for
					// status messages to emit
					readMessage = readStatus;

					resolve();
				}
			);

			// Sauce Connect exits with a zero status code when there is a
			// failure, and outputs error messages to stdout, like a boss. Even
			// better, it uses the "Error:" tag for warnings.
			this._handle = on(child.stdout, 'data', function(data: string) {
				if (!readMessage) {
					return;
				}
				String(data)
					.split('\n')
					.some(function(message) {
						// Get rid of the date/time prefix on each message
						const delimiter = message.indexOf(' - ');
						if (delimiter > -1) {
							message = message.slice(delimiter + 3);
						}
						return readMessage(message.trim());
					});
			});

			executor(child, resolve, reject);
		}, readyFile);

		task.then(function() {
			readRunningMessage('');
			readMessage = null;
		});

		return task;
	}

	/**
	 * Attempt to normalize a SauceLabs described environment with the standard
	 * Selenium capabilities
	 *
	 * SauceLabs returns a list of environments that looks like:
	 *
	 * {
	 *     "short_version": "25",
	 *     "long_name": "Firefox",
	 *     "api_name": "firefox",
	 *     "long_version": "25.0b2.",
	 *     "latest_stable_version": "",
	 *     "automation_backend": "webdriver",
	 *     "os": "Windows 2003"
	 * }
	 *
	 * @param environment a SauceLabs environment descriptor
	 * @returns a normalized descriptor
	 */
	protected _normalizeEnvironment(environment: any): NormalizedEnvironment {
		const windowsMap: any = {
			'Windows 2003': 'Windows XP',
			'Windows 2008': 'Windows 7',
			'Windows 2012': 'Windows 8',
			'Windows 2012 R2': 'Windows 8.1',
			'Windows 10': 'Windows 10'
		};

		const browserMap: any = {
			microsoftedge: 'MicrosoftEdge'
		};

		let os = environment.os;
		let platformName = os;
		let platformVersion: string;
		if (os.indexOf('Windows') === 0) {
			os = windowsMap[os] || os;
			platformName = 'Windows';
			platformVersion = os.slice('Windows '.length);
		} else if (os.indexOf('Mac') === 0) {
			platformName = 'OS X';
			platformVersion = os.slice('Mac '.length);
		}

		const platform =
			platformName + (platformVersion ? ' ' + platformVersion : '');
		const browserName =
			browserMap[environment.api_name] || environment.api_name;
		const version = environment.short_version;

		return {
			platform,
			platformName,
			platformVersion,

			browserName,
			browserVersion: version,
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

export interface SauceLabsProperties extends TunnelProperties {
	directDomains: string[];
	tunnelDomains: string[];
	domainAuthentication: string[];
	fastFailDomains: string[];
	isSharedTunnel: boolean;
	logFile: string;
	pidFile: string;
	logFileSize: number;
	logTrafficStats: number;
	restUrl: string;
	skipSslDomains: string[];
	squidOptions: string;
	useProxyForTunnel: boolean;
	vmVersion: string;
}

export type SauceLabsOptions = Partial<SauceLabsProperties>;

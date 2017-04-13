import { Config as BaseConfig, Events, GenericBrowser } from './Browser';
import { initialize } from './Executor';
import { parseValue } from '../common/util';
import Dom from '../reporters/Dom';

/**
 * An executor for running suites in a remote browser. This executor is intended to be started and managed by Intern
 * itself rather than by end-user runner scripts.
 */
export default class Remote extends GenericBrowser<Events, Config> {
	static initialize(config?: Config) {
		return initialize<Events, Config, Remote>(Remote, config);
	}

	protected _debug: boolean;

	constructor(config: Config) {
		super({ reporters: [{ reporter: 'dom' }] });

		this.registerReporter('dom', Dom);

		if (config) {
			this.configure(config);
		}
	}

	protected _processOption(name: keyof Config, value: any) {
		switch (name) {
			case 'runInSync':
				this._debug = parseValue(name, value, 'boolean');
				break;

			case 'sessionId':
				this.config[name] = parseValue(name, value, 'string');
				break;

			case 'socketPort':
				this.config[name] = parseValue(name, value, 'number');
				break;

			default:
				super._processOption(name, value);
				break;
		}
	}
}

export { Events };

export interface Config extends BaseConfig {
	runInSync?: boolean;
	sessionId?: string;
	socketPort?: number;
}

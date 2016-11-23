import { Config } from '../../interfaces';
import { Executor } from './Executor';
import { PreExecutor } from './PreExecutor';
import { Suite } from '../Suite';

// AMD modules
import * as has from 'dojo/has';
import * as lang from 'dojo/lang';
import * as Promise from 'dojo/Promise';

/**
 * The Client executor is used to run unit tests in the local environment.
 *
 * @constructor module:intern/lib/executors/Client
 * @extends module:intern/lib/executors/Executor
 */
export class Client extends Executor {
	mode: 'client';

	constructor(config: Config, preExecutor: PreExecutor) {
		super(config, preExecutor)

		this.config = lang.deepDelegate(this.config, {
			reporters: [ 'Console' ]
		});

		if (has('host-browser')) {
			this.config.reporters.push('Html');
		}
	}

	_afterRun() {
		return super._afterRun.apply(this, arguments).finally(() => {
			this.reporterManager.empty();
		});
	}

	_beforeRun() {
		const config = this.config;
		const suite = new Suite({
			// rootSuiteName is provided by ClientSuite
			name: config.rootSuiteName || null,
			grep: config.grep,
			sessionId: config.sessionId,
			timeout: config.defaultTimeout,
			reporterManager: this.reporterManager,
			bail: config.bail
		});

		this.suites = [ suite ];

		return super._beforeRun.apply(this, arguments).then(() => {
			return this._loadTestModules(config.suites);
		});
	}
}

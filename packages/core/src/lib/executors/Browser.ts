import { global, request } from '@theintern/common';
import {
  createConfigurator,
  getDefaultBasePath,
  getDefaultInternPath,
  isAbsolute,
  parseQuery
} from '../browser';
import * as console from '../common/console';
import { hasGlobs, join } from '../common/path';
import { parseArgs } from '../config';
import ConsoleReporter from '../reporters/Console';
import Dom from '../reporters/Dom';
import Html from '../reporters/Html';
import { RuntimeEnvironment } from '../types';
import Executor, { Config, Events, ExecutorConfig, Plugins } from './Executor';

/**
 * A Browser executor is used to run unit tests in a browser.
 */
export default class Browser extends Executor<Events, Plugins> {
  constructor(config?: ExecutorConfig) {
    super(createConfigurator, {
      internPath: getDefaultInternPath(),
      basePath: getDefaultBasePath(),
      reporters: [{ name: 'html' }, { name: 'console' }]
    });

    // Add in any additional config options
    if (config) {
      this.configure(config);
    }

    // Report uncaught errors
    global.addEventListener(
      'unhandledRejection',
      (event: PromiseRejectionEvent) => {
        console.warn('Unhandled rejection:', event);
        const { warnOnUnhandledRejection } = this.config;
        if (
          warnOnUnhandledRejection &&
          (warnOnUnhandledRejection === true ||
            warnOnUnhandledRejection.test(`${event.reason}`))
        ) {
          this.emit('warning', `${event.reason}`);
        } else {
          this.emit('error', event.reason);
        }
      }
    );

    global.addEventListener('error', (event: ErrorEvent) => {
      console.warn('Unhandled error:', event);
      const error = new Error(event.message);
      if (
        this.config.warnOnUncaughtException &&
        (this.config.warnOnUncaughtException === true ||
          this.config.warnOnUncaughtException.test(`${error}`))
      ) {
        this.emit('warning', `${error}`);
      } else {
        error.stack = `${event.filename}:${event.lineno}:${event.colno}`;
        this.emit('error', error);
      }
    });

    this.registerReporter('html', options => new Html(this, options));
    this.registerReporter('dom', options => new Dom(this, options));
    this.registerReporter(
      'console',
      options => new ConsoleReporter(this, options)
    );

    this.log('done constructing Browser');
  }

  get environment(): RuntimeEnvironment {
    return 'browser';
  }

  /**
   * Load a script or scripts via script injection.
   *
   * @param script a path to a script
   */
  loadScript(script: string | string[], isEsm = false): Promise<void> {
    if (typeof script === 'string') {
      script = [script];
    }

    return script.reduce((previous, script) => {
      if (script[0] !== '/' && !/https?:\/\//.test(script)) {
        script = `${this.config.basePath}${script}`;
      }
      if (/\.\?$/.test(script)) {
        script = script.replace(/\?$/, 'js');
      }
      return previous.then(() => injectScript(script, isEsm));
    }, Promise.resolve());
  }

  parseQuery(query?: string) {
    return parseArgs(parseQuery(query));
  }

  async resolveConfig() {
    await super.resolveConfig();

    this.log('resolving browser config');

    const config = this.config;

    if (!isAbsolute(config.basePath)) {
      config.basePath = join(config.internPath, config.basePath);
    }

    if (config.suites && hasGlobs(config.suites)) {
      config.suites = await this._resolveSuites(config.suites);
    }

    if (config?.browser?.suites && hasGlobs(config.browser.suites)) {
      config.browser.suites = await this._resolveSuites(config.browser.suites);
    }
  }

  protected async _resolveSuites(suites: string[]): Promise<string[]> {
    try {
      const response = await request('__resolveSuites__', {
        query: { suites }
      });
      return await response.json<string[]>();
    } catch (error) {
      throw new Error('The server does not support suite glob resolution');
    }
  }
}

export { Events, Config };

function injectScript(path: string, isEsm: boolean): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const doc: Document = global.document;
    const scriptTag = doc.createElement('script');
    scriptTag.addEventListener('load', () => {
      resolve();
    });
    scriptTag.addEventListener('error', event => {
      console.error(`Error loading ${path}:`, event);
      reject(new Error(`Unable to load ${path}`));
    });
    if (isEsm) {
      scriptTag.type = 'module';
    }
    scriptTag.src = path;
    scriptTag.defer = true;
    const scriptTarget = document.head || document.body;
    scriptTarget.appendChild(scriptTag);
  });
}

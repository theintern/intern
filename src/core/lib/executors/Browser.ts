import { Minimatch } from 'minimatch';
import { request, Task, CancellablePromise, global } from '../../../common';

import * as console from '../common/console';
import Executor, { Config, Events, Plugins } from './Executor';
import { dirname, join, normalizePathEnding } from '../common/path';
import { getDefaultBasePath } from '../browser/util';
import { RuntimeEnvironment } from '../types';

// Reporters
import Html from '../reporters/Html';
import Dom from '../reporters/Dom';
import ConsoleReporter from '../reporters/Console';

/**
 * A Browser executor is used to run unit tests in a browser.
 */
export default class Browser extends Executor<Events, Config, Plugins> {
  constructor(options?: { [key in keyof Config]?: any }) {
    super(<Config>{
      basePath: '',
      internPath: ''
    });

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

    if (options) {
      this.configure(options);
    }
  }

  get environment(): RuntimeEnvironment {
    return 'browser';
  }

  /**
   * Load a script or scripts via script injection.
   *
   * @param script a path to a script
   */
  loadScript(
    script: string | string[],
    isEsm = false
  ): CancellablePromise<void> {
    if (typeof script === 'string') {
      script = [script];
    }

    return script.reduce((previous, script) => {
      if (script[0] !== '/' && !/https?:\/\//.test(script)) {
        script = `${this.config.basePath}${script}`;
      }
      return previous.then(() => injectScript(script, isEsm));
    }, Task.resolve());
  }

  protected _resolveConfig() {
    return super._resolveConfig().then(() => {
      const config = this.config;
      // const currentPath = global.location.pathname;

      if (!config.internPath) {
        const scripts = document.scripts;
        for (let i = 0; i < scripts.length; i++) {
          const scriptPath = scripts[i].src;
          if (/browser\/intern.js/.test(scriptPath)) {
            config.internPath = dirname(dirname(scriptPath));
          }
        }

        if (!config.internPath) {
          config.internPath = '/';
        }
      }

      if (!config.basePath) {
        config.basePath = getDefaultBasePath();
      } else if (/^\./.test(config.basePath)) {
        // The user provided a relative value for basePath. Resolve it
        // relative to the path to Intern's index.html.
        config.basePath = join(config.internPath, config.basePath);
      }

      (['basePath', 'internPath'] as ('basePath' | 'internPath')[]).forEach(
        property => {
          config[property] = normalizePathEnding(config[property]);
        }
      );

      // Combine suites and browser.suites into browser.suites
      const suites = (config.browser.suites = [
        ...config.suites,
        ...config.browser.suites
      ]);

      // Clear out the suites list after combining the suites
      delete config.suites;

      const hasGlobs = suites.some(pattern => {
        const matcher = new Minimatch(pattern);
        return matcher.set[0].some(entry => typeof entry !== 'string');
      });

      if (hasGlobs) {
        return request('__resolveSuites__', { query: { suites } })
          .then(response => response.json<string[]>())
          .catch(() => {
            throw new Error(
              'The server does not support suite glob resolution'
            );
          })
          .then((data: string[]) => {
            config.browser.suites = data;
          });
      }
    });
  }
}

export { Events, Config };

function injectScript(path: string, isEsm: boolean): CancellablePromise<void> {
  return new Task<void>((resolve, reject) => {
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

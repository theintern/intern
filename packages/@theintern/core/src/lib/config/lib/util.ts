import { BrowserName, DriverDescriptor, WebDriver } from '@theintern/digdug';
import { duplicate } from '@theintern/common';
import { normalizePathEnding } from '../../common/path';
import { EventEmitter, Events } from '../../executors/Executor';
import { DEFAULT_CONFIG } from './const';
import {
  ConfigError,
  InvalidChildConfigError,
  LoadError,
  ParseError,
  UnextendablePropertyError,
  UnknownPropertyError,
} from './error';
import { parseJson } from './json';
import { getBasePath, splitConfigPath } from './path';
import {
  Args,
  Config,
  EnvironmentSpec,
  FileConfig,
  LoadedChildConfig,
  LoadedConfig,
  PluginDescriptor,
  ResourceConfig,
} from './types';

// These are properties that can be extended. They should correspond to the '+'
// keys in the FileConfig type.
const extendableProperties: { [P in keyof LoadedConfig]?: boolean } = {
  benchmarkConfig: true,
  browser: true,
  capabilities: true,
  configs: true,
  coverage: true,
  environments: true,
  functionalSuites: true,
  functionalTimeouts: true,
  instrumenterOptions: true,
  node: true,
  plugins: true,
  reporters: true,
  suites: true,
  tunnelOptions: true,
};

/**
 * Return a complete config using default values for required options
 */
export function createConfig(opts?: Partial<Config>): Config {
  const config: Config = {
    basePath: '',
    bail: false,
    baseline: false,
    benchmark: false,
    browser: {},
    capabilities: {},
    connectTimeout: 30000,
    coverage: [],
    coverageVariable: '__coverage__',
    debug: false,
    defaultTimeout: 30000,
    description: '',
    environments: [{ browserName: 'node' }],
    filterErrorStack: false,
    functionalCoverage: false,
    functionalRetries: 0,
    functionalSuites: [],
    functionalTimeouts: {},
    grep: new RegExp(''),
    heartbeatInterval: 60,
    instrumenterOptions: {},
    internPath: '.',
    leaveRemoteOpen: false,
    loader: { script: 'default' },
    maxConcurrency: Infinity,
    name: 'intern',
    node: {},
    plugins: [],
    remoteOptions: {},
    reporters: [],
    runInSync: false,
    serveOnly: false,
    serverPort: 9000,
    serverUrl: '',
    socketPort: 9001,
    sessionId: '',
    suites: <string[]>[],
    tunnel: 'selenium',
    tunnelOptions: { tunnelId: String(Date.now()) },
    warnOnUncaughtException: false,
    warnOnUnhandledRejection: false,
    ...opts,
  };

  return config;
}

export interface Configurator {
  /**
   * Process arguments and add them to a config
   *
   * @param props properties to add
   * @param config an optional config to add the properties to; if not provided,
   * the properties will be added to an empty config
   */
  addToConfig(
    args: Args | Partial<Config>,
    config?: Partial<Config>
  ): Partial<Config>;

  /**
   * Return a string describing a config object, including any child configs.
   *
   * @param config a config file
   * @param prefix an optional prefix for each line of the description
   */
  describeConfig(file: string, prefix?: string): Promise<string>;

  /**
   * Load a config file.
   *
   * @param file A path to a config file.
   */
  loadConfig(file?: string): Promise<Partial<Config>>;
}

/**
 * Options use to initialize a Configurator
 */
export type ConfiguratorOptions = {
  loadText: TextLoader;
  resolvePath: (file: string, base?: string) => string;
  dirname: (path: string) => string;
  isAbsolute: (path: string) => boolean;
  defaultBasePath: string;
  sep: string;
  eventEmitter?: EventEmitter;
};

/**
 * A function that creates a Configurator
 */
export type ConfiguratorFactory = (
  options: Partial<ConfiguratorOptions>
) => Configurator;

/**
 * Create a Configurator object
 */
export function createConfigurator(options: ConfiguratorOptions): Configurator {
  return new ConfiguratorImpl(options);
}

/**
 * Indicate whether a given value looks like a WebDriver descriptor
 */
export function isWebDriver(value: unknown): value is WebDriver {
  return value && typeof value === 'object' && 'browserName' in value;
}
/**
 * A class for loading and updating a Config object
 */
class ConfiguratorImpl implements Configurator {
  private _loadText: ConfiguratorOptions['loadText'];
  private _resolvePath: ConfiguratorOptions['resolvePath'];
  private _isAbsolute: ConfiguratorOptions['isAbsolute'];
  private _sep: ConfiguratorOptions['sep'];
  private _emitter: ConfiguratorOptions['eventEmitter'];
  private _dirname: ConfiguratorOptions['dirname'];
  private _defaultBasePath: ConfiguratorOptions['defaultBasePath'];

  constructor(options: ConfiguratorOptions) {
    this._loadText = options.loadText;
    this._resolvePath = options.resolvePath;
    this._isAbsolute = options.isAbsolute;
    this._sep = options.sep;
    this._emitter = options.eventEmitter;
    this._dirname = options.dirname;
    this._defaultBasePath = options.defaultBasePath;
  }

  addToConfig(args: Args | Partial<Config>, config: Partial<Config> = {}) {
    return this._addToConfig({ args, config, restrictKeys: true });
  }

  /**
   * Return a string describing a config file, including any child configs.
   */
  async describeConfig(configFile: string, prefix = ''): Promise<string> {
    let description = '';

    let { configFile: file } = splitConfigPath(configFile, this._sep);

    file = file || this._resolvePath(DEFAULT_CONFIG, this._defaultBasePath);

    const config = await this._loadConfigFile(file);

    if (config.description) {
      description += `${prefix}${config.description}`;
    }

    if (config.configs) {
      const childConfigs = config.configs;
      description += `\n\n${prefix}Configs:\n`;
      const width = Object.keys(childConfigs).reduce((width, name) => {
        return Math.max(width, name.length);
      }, 0);
      const lines = Object.keys(childConfigs).map((name) => {
        const child = childConfigs[name];
        while (name.length < width) {
          name += ' ';
        }
        let line = `  ${name}`;
        if (child.description) {
          line += ` (${child.description})`;
        }
        return `${prefix}${line}`;
      });

      description += lines.join('\n');
    }

    return description;
  }

  async loadConfig(file = DEFAULT_CONFIG): Promise<Partial<Config>> {
    // The config file file be provided directly or come from args. Prefer one
    // supplied directly over one from args
    const { configFile, childConfig } = splitConfigPath(file, this._sep);

    // Resolve the file path to an absolute path
    if (configFile) {
      file = this._resolvePath(configFile);
    } else {
      file = this._resolvePath(DEFAULT_CONFIG, this._defaultBasePath);
    }

    this._emit(
      'log',
      `Loading config ${file}${childConfig ? '@' + childConfig : ''}`
    );

    const loadedConfig = await this._loadConfigFile(file);

    if (childConfig) {
      if (!loadedConfig.configs || !loadedConfig.configs[childConfig]) {
        throw new InvalidChildConfigError(childConfig);
      }
      this._addToConfig({
        args: loadedConfig.configs[childConfig],
        config: loadedConfig,
        restrictKeys: true,
      });
    }

    // Remove configs from the loaded config
    const { configs: _, ...config } = loadedConfig;

    // If a basePath wasn't set in the config or via a query arg, and we have a
    // config file path, determine the base path from that.
    if (file && !config.basePath) {
      const basePath = getBasePath(
        file,
        config.basePath,
        this._isAbsolute,
        this._sep
      );
      this._addToConfig({ args: { basePath }, config });
    }

    return config;
  }

  /**
   * Add args to a config, creating a new empty config if one is not provided.
   */
  private _addToConfig({
    args,
    config = {},
    restrictKeys,
    preserveFlags,
  }: {
    args: Args | LoadedConfig;
    config?: LoadedConfig;
    restrictKeys?: boolean;
    preserveFlags?: boolean;
  }): LoadedConfig {
    if (restrictKeys) {
      if ('extends' in args) {
        throw new ConfigError('Cannot use "extends" here');
      }

      if ('config' in args) {
        throw new ConfigError('Cannot use "config" here');
      }

      if ('configs' in args) {
        throw new ConfigError('Cannot use "configs" here');
      }
    }

    // Normalize property names, and filter out any properties that should be
    // ignored
    const normalizedProps: FileConfig = {};
    Object.keys(args)
      .filter((prop) => prop !== '$schema')
      .forEach((prop) => {
        this._normalizePropertyName(normalizedProps, args, prop);
      });

    const normalizedConfig = this._normalizeConfig(normalizedProps);
    return this._mergeNormalizedConfigs({
      target: config,
      source: normalizedConfig,
      preserveFlags,
    });
  }

  /**
   * Emit an event.
   *
   * This is a no-op if the Configurator has no event emitter.
   */
  private async _emit<N extends keyof Events, D extends Events[N]>(
    eventName: N,
    data: D
  ) {
    if (this._emitter) {
      return this._emitter.emit(eventName, data);
    }
    return;
  }

  /**
   * Load config data from a given path, using a given text loader. Any extends
   * properties will be loaded and mixed into the returned config.
   */
  private async _loadConfigFile(configFile: string): Promise<LoadedConfig> {
    let preConfig: FileConfig;
    let config: LoadedConfig;
    let text: string;

    this._emit('log', `Loading config file "${configFile}"`);

    // 1. Load the raw config data
    try {
      text = await this._loadText(configFile);
    } catch (error) {
      throw new LoadError(configFile, error);
    }

    try {
      preConfig = parseJson(text);
    } catch (error) {
      throw new ParseError(text, error);
    }

    // 2. Initialize the output config
    if (preConfig.extends) {
      // If preConfig extends another config, that extended config will be used to
      // initialize the output config

      // Resolve the extended config file path against this config file's path
      const extendedPath = this._resolvePath(
        preConfig.extends,
        this._dirname(configFile)
      );

      delete preConfig.extends;

      this._emit('log', `Loading extended config file "${extendedPath}"`);
      config = await this._loadConfigFile(extendedPath);
    } else {
      // If preConfig doesn't extend anything, initialize the output config with
      // an empty object
      config = {};
    }

    // 3. Process all the keys in preConfig into the output config
    this._addToConfig({ args: preConfig, config, preserveFlags: true });

    // 4. If config has any child configs, process their extends properties
    if (config.configs) {
      this._emit('log', 'Adding child configs to base config');
      for (const child of Object.keys(config.configs)) {
        config.configs[child] = this._resolveChildConfig({
          name: child,
          config: config as { configs: NonNullable<LoadedConfig['configs']> },
        });
      }
    }

    this._emit('log', `Finished loading config file "${configFile}"`);

    return config;
  }

  /**
   * Assign a property from one object to another, overwriting or merging the
   * target property depending on flags in the key.
   *
   * Target and source must be normalized values. Specifically, all target[key]
   * must have the same type as source[key].
   *
   * `key` may be a simple property name or it may have flags ("suites" vs
   * "suites+").
   */
  private _assign<T extends Record<string, any>, K extends keyof T>({
    target,
    source,
    key,
    preserveFlags,
  }: {
    target: T;
    source: T;
    key: K;
    preserveFlags?: boolean;
  }) {
    // `name` will be used when storing a value in the target since any flags
    // should be processed while storing
    const { name, flags } = parsePropertyName(key as string);

    if (shouldMerge(flags) && !extendableProperties[name]) {
      throw new UnextendablePropertyError(name);
    }

    // If the base name is in the target, use the base name as the target key.
    // If the base name is not in the target AND (the additive key is in the
    // target OR we're preserving flags), use the original key as the target
    // key.
    const useKey = !(name in target) && (key in target || preserveFlags);

    const tkey = useKey ? key : name;
    const tval = useKey ? target[key] : target[name];
    const sval = source[key];

    if (tval == null || typeof tval !== 'object' || !shouldMerge(flags)) {
      // The target is null, not an object, or we're not merging -- overwrite it
      // with the source value
      if (sval != null && typeof sval === 'object') {
        target[tkey] = duplicate(sval) as any;
      } else {
        target[tkey] = sval as any;
      }
    } else if (Array.isArray(tval)) {
      // The target is an array -- append the source values to it
      tval.push(...(duplicate(sval) as unknown[]));
    } else {
      // The target is an object and we're merging the source properties into it
      for (const key of Object.keys(sval)) {
        this._assign({ target: tval, source: sval, key: key as keyof Config });
      }
    }
  }

  /**
   * Copy a given property from a source object to a target object, mapping the
   * name to the property equivalent if the name is deprecated.
   */
  private _normalizePropertyName(target: any, source: any, key: string) {
    const { name, flags } = parsePropertyName(key);

    if (shouldMerge(flags) && !extendableProperties[name]) {
      throw new UnextendablePropertyError(name);
    }

    switch (name) {
      case 'showConfig':
        this._emit('deprecated', {
          original: 'showConfig',
          replacement: 'none',
        });
        target[key] = source[key];
        break;

      case 'showConfigs':
        this._emit('deprecated', {
          original: 'showConfigs',
          replacement: 'none',
        });
        target[key] = source[key];
        break;

      case 'requires':
        this._emit('deprecated', {
          original: 'scripts',
          replacement: 'plugins',
          message: 'Set `useLoader: true`',
        });
        target[`plugins${flags}`] = source[key];
        break;

      case 'require':
        this._emit('deprecated', {
          original: 'scripts',
          replacement: 'plugins',
        });
        target[`plugins${flags}`] = source[key];
        break;

      case 'scripts':
        this._emit('deprecated', {
          original: 'scripts',
          replacement: 'plugins',
        });
        target[`plugins${flags}`] = source[key];
        break;

      case 'excludeInstrumentation':
        this._emit('deprecated', {
          original: 'excludeInstrumentation',
          replacement: 'coverage',
        });
        target.coverage = source[key] ? false : [];
        break;

      case 'functionalTimeouts': {
        const val = source[key];
        if (val && val.connectTimeout) {
          const { connectTimeout, ...valCopy } = val;
          this._emit('deprecated', {
            original: 'functionalTimeouts.connectTimeout',
            replacement: 'connectTimeout',
          });
          target.connectTimeout = connectTimeout;
          target[key] = valCopy;
        } else {
          target[key] = source[key];
        }
        break;
      }

      default:
        target[key] = source[key];
        break;
    }
  }

  /**
   * Merge a normalized config into a normalized config
   */
  private _mergeNormalizedConfigs({
    target,
    source,
    preserveFlags,
  }: {
    target: LoadedConfig;
    source: LoadedConfig;
    preserveFlags?: boolean;
  }): LoadedConfig {
    for (const key of Object.keys(source)) {
      this._assign({ target, source, key: key as keyof Config, preserveFlags });
    }
    return target;
  }

  /**
   * Return a normalized Config value
   */
  private _normalizeConfig(
    cfg: Record<string, unknown>,
    isChild: true
  ): LoadedChildConfig;
  private _normalizeConfig(
    cfg: Record<string, unknown>,
    isChild?: false
  ): LoadedConfig;
  private _normalizeConfig(
    cfg: Record<string, unknown>,
    isChild = false
  ): LoadedConfig | LoadedChildConfig {
    const normalizedConfig: LoadedConfig = {};
    Object.keys(cfg)
      .filter((prop) => prop !== 'extends')
      .forEach((prop) => {
        const key = prop as keyof Config;
        const value = this._normalizeValue(key, cfg[key]);
        this._setValue(normalizedConfig, key, value);
      });

    if (cfg.extends) {
      if (isChild) {
        (normalizedConfig as LoadedChildConfig).extends = cfg.extends as string;
      } else {
        throw new ConfigError("'extends' outside of child config");
      }
    }

    return normalizedConfig;
  }

  /**
   * Return a value formatted as an EnvironmentSpec
   */
  private _normalizeEnvironments(value: unknown): EnvironmentSpec[] {
    // Must be a string, object, or array of (string | object)
    let _value = value;
    if (!_value) {
      _value = [];
    } else if (!Array.isArray(_value)) {
      _value = [_value];
    }

    _value = (_value as unknown[]).map((val) => {
      if (isObject(val)) {
        // Use browserName instead of browser
        if (val.browserName == null && typeof val.browser !== 'undefined') {
          val.browserName = val.browser;
        }
        delete val.browser;
      }
      return val;
    });

    const rawEnvs = normalizeValue(
      'environment',
      _value,
      'object[]',
      'browserName'
    );
    return rawEnvs.map((env) => ({
      ...env,
      browserName: getNormalizedBrowserName(env),
    }));
  }

  /**
   * Process a functional timeouts object
   */
  private _normalizeFunctionalTimeouts(
    value: unknown
  ): Config['functionalTimeouts'] {
    const parsedTimeout = normalizeValue('functionalTimeouts', value, 'object');
    type ValidTimeouts = Omit<Config['functionalTimeouts'], 'connectTimeout'>;
    const normalizedTimeout: {
      [K in keyof ValidTimeouts]?: Config['functionalTimeouts'][K];
    } = {};

    // If the given value was an object, mix it in to the
    // default functionalTimeouts
    Object.keys(parsedTimeout).forEach((timeoutKey) => {
      const key = timeoutKey as keyof ValidTimeouts;
      normalizedTimeout[key] = normalizeValue(
        `functionalTimeouts.${key}` as keyof Config,
        parsedTimeout[key],
        'number'
      );
    });

    return normalizedTimeout;
  }

  private _normalizeResourceConfig(
    name: string,
    value: unknown
  ): Partial<ResourceConfig> {
    const normalizedValue: Partial<ResourceConfig> = {};
    const parsedValue = normalizeValue(name, value, 'object');

    if (parsedValue) {
      Object.keys(parsedValue).forEach((k) => {
        const subKey = k as keyof ResourceConfig;
        let resource = parsedValue[subKey];
        let { name } = parsePropertyName(subKey);

        // Switch on the parsed name, but save the parsed value using the
        // original key; we'll want any flags to still be present when the
        // property is later merged into a config.

        switch (name) {
          case 'loader':
            normalizedValue[subKey as typeof name] = normalizeValue(
              name,
              resource,
              'object',
              'script'
            );
            break;

          case 'reporters':
            normalizedValue[subKey as typeof name] = normalizeValue(
              name,
              resource,
              'object[]',
              'name'
            );
            break;

          case 'plugins':
          case 'require':
          case 'requires':
          case 'scripts': {
            let useLoader = false;
            switch (name) {
              case 'scripts': {
                this._emit('deprecated', {
                  original: 'scripts',
                  replacement: 'plugins',
                });
                name = 'plugins';
                break;
              }
              case 'require': {
                this._emit('deprecated', {
                  original: 'require',
                  replacement: 'plugins',
                });
                name = 'plugins';
                break;
              }
              case 'requires': {
                this._emit('deprecated', {
                  original: 'requires',
                  replacement: 'plugins',
                  message: 'Set `useLoader: true`',
                });
                name = 'plugins';
                useLoader = true;
                break;
              }
            }
            resource = normalizeValue(name, resource, 'object[]', 'script');
            if (useLoader) {
              resource.forEach((entry: PluginDescriptor) => {
                entry.useLoader = true;
              });
            }
            normalizedValue[subKey as typeof name] = resource;
            break;
          }

          case 'suites':
            normalizedValue[subKey as typeof name] = normalizeValue(
              name,
              resource,
              'string[]'
            );
            break;

          case 'tsconfig':
            normalizedValue[subKey as typeof name] = normalizeValue(
              name,
              resource,
              (tsconfig: any) => {
                let value: string | false;

                if (tsconfig === false || tsconfig === 'false') {
                  value = false;
                } else if (typeof tsconfig === 'string') {
                  value = tsconfig;
                } else {
                  throw new Error('"tsconfig" must be a string or `false`');
                }

                return value;
              }
            );
            break;

          default: {
            throw new UnknownPropertyError(subKey);
          }
        }
      });
    }

    return normalizedValue;
  }

  /**
   * Normalize tunnelOptions
   */
  private _normalizeTunnelOptions(value: unknown): Config['tunnelOptions'] {
    const opts = normalizeValue('tunnelOptions', value, 'object');
    if (opts.drivers) {
      opts.drivers = opts.drivers
        .map((val: unknown) => {
          if (
            val == null ||
            (typeof val !== 'string' && typeof val !== 'object')
          ) {
            throw new ConfigError(
              `Invalid type for driver "${val}" -- must be string or object`
            );
          }

          if (typeof val === 'string') {
            return normalizeValue(
              'tunnelOptions.drivers',
              val,
              'object',
              'browserName'
            );
          }

          const valObj = val as Record<string, any>;
          if (valObj.name) {
            const { name, ...newVal } = valObj;
            return {
              ...newVal,
              browserName: name,
            };
          }

          return val;
        })
        .map((driver: DriverDescriptor) => normalizeTunnelDriver(driver));
    }
    return opts;
  }

  /**
   * Normalize a key/value pair to a Config value
   */
  private _normalizeValue<
    K extends keyof LoadedConfig,
    V extends LoadedConfig[K]
  >(key: K, value: unknown): V {
    const { name } = parsePropertyName(key);
    let normalizedValue: V;

    switch (name) {
      case 'configs': {
        const configs = normalizeValue(name, value, 'object');
        for (const cfg of Object.keys(configs as any)) {
          configs[cfg] = this._normalizeConfig(configs[cfg], true);
        }
        normalizedValue = configs as V;
        break;
      }

      case 'bail':
      case 'baseline':
      case 'benchmark':
      case 'debug':
      case 'filterErrorStack':
      case 'functionalCoverage':
      case 'serveOnly':
      case 'runInSync':
        normalizedValue = normalizeValue(name, value, 'boolean') as V;
        break;

      case 'showConfig':
        normalizedValue = normalizeValue(name, value, (val: any) => {
          if (val === false || val === 'false') {
            return false;
          }
          if (val === true || val === 'true') {
            return true;
          }
          if (typeof val !== 'string') {
            throw new Error('"showConfig" must be a string or boolean');
          }
          return val;
        }) as V;
        break;

      case 'basePath':
      case 'internPath':
        normalizedValue = normalizePathEnding(
          normalizeValue(name, value, 'string'),
          this._sep
        ) as V;
        break;

      case 'coverageVariable':
      case 'description':
      case 'name':
      case 'sessionId':
      case 'tunnel':
        normalizedValue = normalizeValue(name, value, 'string') as V;
        break;

      case 'functionalBaseUrl':
      case 'serverUrl':
        normalizedValue = normalizeValue(name, value, 'string').replace(
          /\/*$/,
          '/'
        ) as V;
        break;

      case 'functionalSuites':
      case 'suites':
        normalizedValue = normalizeValue(name, value, 'string[]') as V;
        break;

      case 'connectTimeout':
      case 'defaultTimeout':
      case 'functionalRetries':
      case 'heartbeatInterval':
      case 'maxConcurrency':
      case 'serverPort':
      case 'socketPort':
        normalizedValue = normalizeValue(name, value, 'number') as V;
        break;

      case 'grep':
        normalizedValue = normalizeValue(name, value, 'regexp') as V;
        break;

      case 'benchmarkConfig':
      case 'capabilities':
      case 'instrumenterOptions':
      case 'remoteOptions':
        normalizedValue = normalizeValue(name, value, 'object') as V;
        break;

      case 'tunnelOptions': {
        normalizedValue = this._normalizeTunnelOptions(value) as V;
        break;
      }

      case 'loader':
        normalizedValue = normalizeValue(name, value, 'object', 'script') as V;
        break;

      case 'reporters':
        normalizedValue = normalizeValue(name, value, 'object[]', 'name') as V;
        break;

      case 'plugins':
      case 'requires':
      case 'require':
      case 'scripts':
        normalizedValue = normalizeValue(
          name,
          value,
          'object[]',
          'script'
        ) as V;
        break;

      case 'node':
      case 'browser':
        normalizedValue = this._normalizeResourceConfig(name, value) as V;
        break;

      case 'proxy':
        if (value == null) {
          normalizedValue = undefined as V;
        } else {
          normalizedValue = normalizeValue(name, value, 'string') as V;
        }
        break;

      case 'environments':
        normalizedValue = this._normalizeEnvironments(value) as V;
        break;

      case 'leaveRemoteOpen':
        try {
          normalizedValue = normalizeValue(name, value, 'boolean') as V;
        } catch (error) {
          normalizedValue = normalizeValue(name, value, 'string', 'fail') as V;
        }
        break;

      case 'coverage':
        try {
          normalizedValue = normalizeValue(name, value, 'boolean', false) as V;
        } catch (error) {
          normalizedValue = normalizeValue(name, value, 'string[]') as V;
        }
        break;

      case 'functionalTimeouts': {
        normalizedValue = this._normalizeFunctionalTimeouts(value) as V;
        break;
      }

      case 'warnOnUncaughtException':
      case 'warnOnUnhandledRejection': {
        try {
          normalizedValue = normalizeValue(name, value, 'boolean') as V;
        } catch (error) {
          normalizedValue = normalizeValue(name, value, 'regexp') as V;
        }
        break;
      }

      default: {
        this._emit('warning', `Unknown property "${name}"`);
        normalizedValue = value as V;
      }
    }

    return normalizedValue;
  }

  private _resolveChildConfig({
    name,
    config,
  }: {
    name: string;
    config: { configs: NonNullable<LoadedConfig['configs']> };
  }): Omit<LoadedChildConfig, 'extends'> {
    this._emit(
      'log',
      `Resolving child config ${name} in ${JSON.stringify(config, null, '  ')}`
    );

    const child = config.configs[name];
    if (!child) {
      throw new InvalidChildConfigError(child);
    }

    if (child.extends) {
      let extendedChild: LoadedChildConfig = {};
      if (Array.isArray(child.extends)) {
        extendedChild = duplicate(
          this._resolveChildConfig({ name: child.extends[0], config })
        );
        for (const ext of child.extends.slice(1)) {
          extendedChild = this._mergeNormalizedConfigs({
            target: extendedChild,
            source: this._resolveChildConfig({ name: ext, config }),
          });
        }
        extendedChild = this._mergeNormalizedConfigs({
          target: extendedChild,
          source: child,
        });
      } else {
        extendedChild = this._mergeNormalizedConfigs({
          target: duplicate(
            this._resolveChildConfig({ name: child.extends, config })
          ),
          source: child,
        });
      }
      delete extendedChild.extends;
      return extendedChild;
    } else {
      return child;
    }
  }

  /**
   * Set a value on a target, where the key may be a dot-separated set of keys.
   */
  private _setValue(target: any, key: string, value: unknown) {
    if (key.indexOf('.') !== -1) {
      const parts = key.split('.');
      while (parts.length > 1) {
        const part = parts.shift()!;
        if (!target[part]) {
          target[part] = {};
        }
        target = target[part];
      }
      target[parts[0]] = value;
    } else {
      target[key] = value;
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
// support functions
////////////////////////////////////////////////////////////////////////////////

interface TextLoader {
  (path: string): Promise<string>;
}

type TypeName =
  | 'string'
  | 'boolean'
  | 'number'
  | 'regexp'
  | 'object'
  | 'string[]'
  | 'object[]';

type Parser<T> = (value: any) => T;

interface PropertyName {
  name: keyof LoadedConfig;
  flags: string | null;
}

/**
 * Return a normalized browser name for an environment
 */
function getNormalizedBrowserName(
  nameOrEnv: string | EnvironmentSpec
): BrowserName {
  const name =
    typeof nameOrEnv === 'string' ? nameOrEnv : nameOrEnv.browserName;
  if (name === 'ie') {
    return 'internet explorer';
  }
  if (name && /^edge/.test(name)) {
    return name.replace(/^edge/, 'MicrosoftEdge') as BrowserName;
  }

  return name as BrowserName;
}

/**
 * Normalize the structure of a tunnel driver object
 */
function normalizeTunnelDriver(driver: DriverDescriptor): DriverDescriptor {
  if (isWebDriver(driver)) {
    return {
      ...driver,
      browserName: getNormalizedBrowserName(driver.browserName),
    };
  }
  return driver;
}

/**
 * Evaluate a config property name
 *
 * Parse a name, splitting it into a config property name and any modifiers
 * (such as '+').
 */
function parsePropertyName(key: string): PropertyName {
  if (key[key.length - 1] === '+') {
    return { name: key.slice(0, -1) as keyof Config, flags: '+' };
  }
  return { name: key as keyof Config, flags: '' };
}

/**
 * Parse a particular type of value from a given value
 *
 * @param name The 'name' of the value being parsed (used for error messages)
 * @param value A value to parse something from
 * @param parser The type of thing to parse, or a parser function
 * @param requiredProperty Only used with 'object' and 'object[]' parsers
 */
function normalizeValue(
  name: string,
  value: any,
  parser: 'boolean' | Parser<boolean>
): boolean;
function normalizeValue<E extends boolean>(
  name: string,
  value: any,
  parser: 'boolean' | Parser<E>,
  expectedValue: E
): E;
function normalizeValue(
  name: string,
  value: any,
  parser: 'number' | Parser<number>
): number;
function normalizeValue(
  name: string,
  value: any,
  parser: 'regexp' | Parser<RegExp>
): RegExp;
function normalizeValue<
  N extends string,
  R extends Pick<{ [key: string]: any }, N>
>(
  name: string,
  value: any,
  parser: 'object' | Parser<R>,
  requiredProperty?: N
): R;
function normalizeValue<
  N extends string,
  R extends Pick<{ [key: string]: any }, N>
>(
  name: string,
  value: any,
  parser: 'object[]' | Parser<R[]>,
  requiredProperty?: N
): R[];
function normalizeValue<E extends string>(
  name: string,
  value: any,
  parser: 'string' | Parser<E>,
  expectedValue: E
): E;
function normalizeValue(
  name: string,
  value: any,
  parser: 'string' | Parser<string>
): string;
function normalizeValue(
  name: string,
  value: any,
  parser: 'string[]' | Parser<string[]>
): string[];
function normalizeValue<N>(name: string, value: any, parser: Parser<N>): N;
function normalizeValue(
  name: string,
  value: any,
  parser: TypeName | Parser<unknown>,
  requiredPropertyOrExpectedValue?: string
): unknown {
  switch (parser) {
    case 'boolean':
      if (typeof value === 'boolean') {
        return value;
      }
      if (value === 'true') {
        return true;
      }
      if (value !== 'false') {
        throw new Error(`Non-boolean value "${value}" for ${name}`);
      }
      return false;

    case 'number': {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        throw new Error(`Non-numeric value "${value}" for ${name}`);
      }
      return numValue;
    }

    case 'regexp':
      if (typeof value === 'string') {
        return new RegExp(value);
      }
      if (!(value instanceof RegExp)) {
        throw new Error(`Non-regexp value "${value}" for ${name}`);
      }
      return value;

    case 'object':
      if (typeof value === 'string') {
        try {
          value = value ? JSON.parse(value) : {};
        } catch (error) {
          if (!requiredPropertyOrExpectedValue) {
            throw new Error(`Non-object value "${value}" for ${name}`);
          }
          value = { [requiredPropertyOrExpectedValue]: value };
        }
      }

      // A value of type 'object' should be a simple object, not a
      // built-in type like RegExp or Array
      if (Object.prototype.toString.call(value) !== '[object Object]') {
        throw new Error(`Non-object value "${value}" for ${name}`);
      }
      if (
        requiredPropertyOrExpectedValue &&
        !value[requiredPropertyOrExpectedValue]
      ) {
        throw new Error(
          `Invalid value "${JSON.stringify(
            value
          )}" for ${name}: missing '${requiredPropertyOrExpectedValue}' property`
        );
      }

      return value;

    case 'object[]':
      if (!value) {
        value = [];
      }
      if (!Array.isArray(value)) {
        value = [value];
      }
      return value.map((item: any) => {
        return normalizeValue(
          name,
          item,
          'object',
          requiredPropertyOrExpectedValue
        );
      });

    case 'string':
      if (typeof value !== 'string') {
        throw new Error(`Non-string value "${value}" for ${name}`);
      }
      if (
        typeof requiredPropertyOrExpectedValue === 'string' &&
        value !== requiredPropertyOrExpectedValue
      ) {
        throw new Error(`Invalid value "${value}" for ${name}`);
      }
      return value;

    case 'string[]':
      if (!value) {
        value = [];
      }
      if (typeof value === 'string') {
        value = [value];
      }
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
        throw new Error(`Non-string[] value "${value}" for ${name}`);
      }
      return value;

    default:
      if (typeof parser !== 'function') {
        throw new Error('Parser must be a valid type name');
      }
      return parser(value);
  }
}

/**
 * Indicate whether a value is a non-null object
 */
function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val != null;
}

/**
 * Indicate whether the flags on a property name indicate that it should be
 * merged with an existing value
 */
function shouldMerge(flags: string | null) {
  return flags && flags.indexOf('+') !== -1;
}

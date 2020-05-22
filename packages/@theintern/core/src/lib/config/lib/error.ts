/**
 * Possible types of config error
 */
export enum ConfigErrorType {
  GENERIC = 1,
  READ,
  PARSE,
  UNKNOWN_PROPERTY,
  CHILD_CONFIG,
  UNEXTENDABLE_PROPERTY
}

/**
 * An error thrown during the configuration process
 */
export class ConfigError extends Error {
  static is(value: any): value is ConfigError {
    return value instanceof ConfigError;
  }

  type: ConfigErrorType;

  constructor(message: string, type?: ConfigErrorType, public related?: Error) {
    super(message);
    this.name = 'ConfigError';
    this.type = type ?? ConfigErrorType.GENERIC;
  }
}

export class InvalidChildConfigError extends ConfigError {
  static type = ConfigErrorType.CHILD_CONFIG;

  static is(value: any): value is InvalidChildConfigError {
    return ConfigError.is(value) && value.type === InvalidChildConfigError.type;
  }

  constructor(public name: string) {
    super(`Invalid child config "${name}"`, InvalidChildConfigError.type);
    this.name = 'InvalidChildConfigError';
  }
}

export class LoadError extends ConfigError {
  static is(value: any): value is LoadError {
    return ConfigError.is(value) && value.type === ConfigErrorType.READ;
  }

  constructor(public file: string, related: Error) {
    super(
      `Could not read config file "${file}"`,
      ConfigErrorType.READ,
      related
    );
    this.name = 'LoadError';
  }
}

export class ParseError extends ConfigError {
  static is(value: any): value is ParseError {
    return ConfigError.is(value) && value.type === ConfigErrorType.PARSE;
  }

  constructor(public text: string, related: Error) {
    super(
      `Could not parse "${text ? text.slice(0, 20) : text}...`,
      ConfigErrorType.PARSE,
      related
    );
    this.name = 'ParseError';
  }
}

export class UnknownPropertyError extends ConfigError {
  static is(value: any): value is UnknownPropertyError {
    return (
      ConfigError.is(value) && value.type === ConfigErrorType.UNKNOWN_PROPERTY
    );
  }

  constructor(public name: string) {
    super(`Unknown property name "${name}"`, ConfigErrorType.PARSE);
    this.name = 'UnknownPropertyError';
  }
}

export class UnextendablePropertyError extends ConfigError {
  static is(value: any): value is UnextendablePropertyError {
    return (
      ConfigError.is(value) &&
      value.type === ConfigErrorType.UNEXTENDABLE_PROPERTY
    );
  }

  constructor(public name: string) {
    super(
      `Property "${name}" cannot be extended`,
      ConfigErrorType.UNEXTENDABLE_PROPERTY
    );
    this.name = 'UnextendablePropertyError';
  }
}

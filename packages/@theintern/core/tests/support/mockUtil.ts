import rewiremock from './rewiremock';

/**
 * Import a module using some replacement dependencies.
 *
 * @param loader A callback to import or require the module that will have
 * replaced dependencies
 * @param config A configuration
 */
export async function mockImport<M>(
  loader: () => Promise<M>,
  updateDeps?: (replace: Replacer) => void | Promise<void>
): Promise<M> {
  return rewiremock.around(loader, toCreator(updateDeps));
}

/**
 * An `() => import('something')` callback.
 */
export type Importer<M> = () => Promise<M>;

/**
 * A module that has a `default` property.
 */
export interface HasDefault {
  default: any;
}

export class BasicMocker<M extends BasicMock = BasicMock> {
  protected _mock: M;
  protected _modId: string;

  constructor(mock: M, modId: string) {
    this._mock = mock;
    this._modId = modId;
  }

  /**
   * Replace this module with another module
   */
  withModule(modId: string): BasicMocker {
    this._mock.by(modId);
    return this;
  }

  /**
   * Defer all accesses of non-replaced properties to the original module.
   */
  transparently() {
    this._mock.callThrough();
    return this;
  }

  /**
   * Replace this module with a fresh copy of itself.
   */
  withItself() {
    this._mock.by(this._modId);
    return this;
  }
}

export class TypedMocker<
  T,
  M extends TypedMock<T> = TypedMock<T>
> extends BasicMocker<M> {
  constructor(mock: M) {
    super(mock, '');
  }

  with(replacement: Partial<T>): BasicMocker {
    this._mock.with(replacement);
    if ('default' in replacement) {
      this._mock.es6();
    }
    return new BasicMocker(this._mock, this._modId);
  }
}

export class HasDefaultMocker<T extends HasDefault> extends TypedMocker<
  T,
  HasDefaultMock<T>
> {
  withDefault(replacement: T['default']): BasicMocker {
    this._mock.withDefault(replacement);
    return new BasicMocker(this._mock, this._modId);
  }
}

export class AnyMocker extends BasicMocker<HasDefaultMock<any>> {
  /**
   * Replace this module with an object.
   */
  with(replacement: any): BasicMocker {
    this._mock.with(replacement);
    return new BasicMocker(this._mock, this._modId);
  }

  /**
   * Replace this module's default export with an object.
   */
  withDefault(replacement: any): BasicMocker {
    this._mock.withDefault(replacement);
    return new BasicMocker(this._mock, this._modId);
  }
}

/**
 * A function that replaces the module imported by an Importer with something
 * else.
 */
export interface Replacer {
  // Note that the HasDefault version has to go above the fully generic one to
  // be detected by TS
  (id: string): AnyMocker;
  <M extends HasDefault>(importer: Importer<M>): HasDefaultMocker<M>;
  <M>(importer: Importer<M>): TypedMocker<M>;
}

function createReplacer(r: typeof rewiremock) {
  return function replacer<M>(idOrImporter: string | Importer<M>) {
    if (typeof idOrImporter === 'string') {
      return new AnyMocker(r(idOrImporter), idOrImporter);
    } else {
      const mock = r(idOrImporter);
      if (isDefaultMock(mock)) {
        return new HasDefaultMocker(mock);
      }
      return new TypedMocker(mock);
    }
  } as Replacer;
}

function isDefaultMock<M extends HasDefault>(
  mock: any
): mock is HasDefaultMock<M> {
  return mock && 'withDefault' in mock;
}

function toCreator(config?: (replace: Replacer) => void | Promise<void>) {
  if (!config) {
    return;
  }
  return function(r: typeof rewiremock) {
    return config(createReplacer(r));
  };
}

/**
 * The most basic type of Mock from rewiremock. It's untyped.
 */
interface BasicMock {
  by(modId: string): BasicMock;
  callThrough(): BasicMock;
  es6(): BasicMock;
}

/**
 * A typed mock supporting replacement.
 */
interface TypedMock<T> extends BasicMock {
  with(replacements: Partial<T>): BasicMock;
}

/**
 * A typed mock for a module with a default export.
 */
interface HasDefaultMock<T extends HasDefault> extends TypedMock<T> {
  withDefault(def: T['default']): BasicMock;
}

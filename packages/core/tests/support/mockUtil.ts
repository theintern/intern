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

export class BasicMocker {
  protected _mock: BasicMock;
  protected _modId: string;

  constructor(mock: BasicMock, modId: string) {
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

export class Mocker extends BasicMocker {
  /**
   * Replace this module with an object.
   */
  with(replacement: any) {
    (this._mock as Mock).with(replacement);
    return this;
  }

  /**
   * Replace this module's default export with an object.
   */
  withDefault(replacement: any) {
    (this._mock as Mock).withDefault(replacement);
    return this;
  }
}

export class TypedMocker<M> extends BasicMocker {
  constructor(mock: TypedMock<M>) {
    super((mock as unknown) as BasicMock, '');
  }

  with(replacement: Partial<M>) {
    ((this._mock as unknown) as TypedMock<M>).with(replacement);
    return this;
  }
}

export class HasDefaultMocker<M extends HasDefault> extends TypedMocker<M> {
  withDefault(replacement: M['default']) {
    ((this._mock as unknown) as HasDefaultMock<M>).withDefault(replacement);
    return this;
  }
}

/**
 * A function that replaces the module imported by an Importer with something
 * else.
 */
export interface Replacer {
  // Note that the HasDefault version has to go above the fully generic one to
  // be detected by TS
  (id: string): Mocker;
  <M extends HasDefault>(importer: Importer<M>): HasDefaultMocker<M>;
  <M>(importer: Importer<M>): TypedMocker<M>;
}

function createReplacer(r: typeof rewiremock) {
  return function replacer<M>(idOrImporter: string | Importer<M>) {
    if (typeof idOrImporter === 'string') {
      return new Mocker(r(idOrImporter), idOrImporter);
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
  return function (r: typeof rewiremock) {
    return config(createReplacer(r));
  };
}

/**
 * The most basic type of Mock from rewiremock. It's untyped.
 */
interface BasicMock {
  by(modId: string): this;
  callThrough(): this;
}

/**
 * An untyped mock supporting replacment.
 */
interface Mock extends BasicMock {
  by(modId: string): this;
  with(replacements: any): this;
  withDefault(replacements: any): this;
}

/**
 * A typed mock supporting replacement.
 */
interface TypedMock<M> {
  with(replacements: Partial<M>): this;
}

/**
 * A typed mock for a module with a default export.
 */
interface HasDefaultMock<M extends HasDefault> extends TypedMock<M> {
  withDefault(def: M['default']): this;
}

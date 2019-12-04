/**
 * This is the object interface for registering suites. Typically it will be
 * accessed using [[lib/executors/Executor.Executor.getInterface]], like:
 *
 * ```js
 * const { registerSuite } = intern.getInterface('object');
 * ```
 *
 * It may also be imported as a module, like
 *
 * ```js
 * import registerSuite from 'intern/lib/interfaces/object';
 * ```
 *
 * Suites are described using objects. The object structure is a subset of suite
 * properties, specifically name, the lifecycle methods, and tests.
 *
 * ```js
 * registerSuite('foo', {
 *     before() {},
 *     afterEach() {},
 *     tests: {
 *         bar() {},
 *         baz() {}
 *     }
 * });
 * ```
 *
 * Tests may also describe sub-suites:
 *
 * ```js
 * registerSuite('foo', {
 *     tests: {
 *         fooStuff {
 *             tests: {
 *                 bar() {},
 *                 baz() {}
 *             }
 *         }
 *     }
 * });
 * ```
 *
 * Sub-suites don't need name properties, and may also omit the 'tests' nesting
 * if no lifecycle functions are in use. The rule is that if a 'tests' property
 * isn't in the sub-suite object, then every property is assumed to refer to a
 * test.
 *
 * ```js
 * registerSuite('foo', {
 *     fooStuff {
 *         bar() {},
 *         baz() {}
 *     }
 * });
 * ```
 */ /** */
import { global } from '../../../common';

import Suite, { SuiteOptions, SuiteProperties } from '../Suite';
import Test, { TestFunction, isTestFunction } from '../Test';
import { Executor } from '../executors/Executor';

/**
 * Importable interface that uses the currently installed global executor
 */
export default function registerSuite(
  name: string,
  descriptorOrFactory: ObjectSuiteDescriptor | ObjectSuiteFactory | Tests
) {
  return _registerSuite(global.intern, name, descriptorOrFactory);
}

/**
 * Interface factory used by Executor
 */
export function getInterface(executor: Executor) {
  return {
    registerSuite(
      name: string,
      descriptorOrFactory: ObjectSuiteDescriptor | ObjectSuiteFactory | Tests
    ) {
      return _registerSuite(executor, name, descriptorOrFactory);
    }
  };
}

export interface ObjectInterface {
  registerSuite(
    name: string,
    mainDescriptor: ObjectSuiteDescriptor | ObjectSuiteFactory | Tests
  ): void;
}

export interface Tests {
  [name: string]: ObjectSuiteDescriptor | TestFunction | Tests;
}

export interface ObjectSuiteDescriptor extends Partial<SuiteProperties> {
  tests: Tests;
}

export interface ObjectSuiteFactory {
  (): ObjectSuiteDescriptor | Tests;
}

export function isSuiteDescriptorFactory<T>(value: any): value is T {
  return typeof value === 'function';
}

export function createSuite<S extends typeof Suite, T extends typeof Test>(
  name: string,
  parent: Suite,
  descriptor: ObjectSuiteDescriptor | Tests,
  SuiteClass: S,
  TestClass: T
) {
  let options: SuiteOptions = { name: name, parent };
  let tests: Tests;

  // Initialize a new SuiteOptions object from the provided
  // ObjectSuiteDescriptor
  if (isObjectSuiteDescriptor(descriptor)) {
    const keys = Object.keys(descriptor).filter(key => key !== 'tests');
    for (const key of keys) {
      let optionsKey = <keyof SuiteOptions>key;

      // Convert 'setup' and 'teardown' to 'before' and 'after'
      if (key === 'setup') {
        parent.executor.emit('deprecated', {
          original: 'Suite#setup',
          replacement: 'Suite#before'
        });
        optionsKey = 'before';
      } else if (key === 'teardown') {
        parent.executor.emit('deprecated', {
          original: 'Suite#teardown',
          replacement: 'Suite#after'
        });
        optionsKey = 'after';
      }

      (options as any)[optionsKey] =
        descriptor[<keyof ObjectSuiteDescriptor>key];
    }

    tests = descriptor.tests;
  } else {
    tests = descriptor;
  }

  const suite = new SuiteClass(options);

  Object.keys(tests)
    .map(name => {
      if (
        name === 'before' ||
        name === 'after' ||
        name === 'setup' ||
        name === 'teardown' ||
        name === 'beforeEach' ||
        name === 'afterEach'
      ) {
        parent.executor.log(
          `Warning: created test with lifecycle method name "${name}"`
        );
      }

      const thing = tests[name];
      if (isTestFunction(thing)) {
        return new TestClass({ name, test: thing, parent: suite });
      }
      return createSuite(name, suite, { ...thing }, SuiteClass, TestClass);
    })
    .forEach(suiteOrTest => {
      suite.add(suiteOrTest);
    });

  return suite;
}

function isObjectSuiteDescriptor(value: any): value is ObjectSuiteDescriptor {
  return typeof value === 'object' && typeof value.tests === 'object';
}

function _registerSuite(
  executor: Executor,
  name: string,
  descriptorOrFactory: ObjectSuiteDescriptor | ObjectSuiteFactory | Tests
) {
  executor.addSuite(parent => {
    // Enable per-suite closure, to match feature parity with other
    // interfaces like tdd/bdd more closely; without this, it becomes
    // impossible to use the object interface for functional tests since
    // there is no other way to create a closure for each main suite
    let descriptor: ObjectSuiteDescriptor | Tests;

    if (isSuiteDescriptorFactory<ObjectSuiteFactory>(descriptorOrFactory)) {
      descriptor = descriptorOrFactory();
    } else {
      descriptor = descriptorOrFactory;
    }

    parent.add(createSuite(name, parent, descriptor, Suite, Test));
  });
}

/**
 * A consistent API to manage how callers can cleanup when doing a function.
 */
export interface Handle {
  /**
   * Perform the destruction/cleanup logic associated with this handle
   */
  destroy(): void;
}

/**
 * Returns an object with a destroy method that, when called, calls the
 * passed-in destructor. This is intended to provide a unified interface for
 * creating "remove" / "destroy" handlers for event listeners, timers, etc.
 *
 * @param destructor A function that will be called when the handle's `destroy`
 * method is invoked
 */
export function createHandle(destructor: () => void): Handle {
  let called = false;
  return {
    destroy() {
      if (!called) {
        called = true;
        destructor();
      }
    }
  };
}

/**
 * Returns a single handle that can be used to destroy multiple handles
 * simultaneously.
 *
 * @param handles An array of handles with `destroy` methods
 */
export function createCompositeHandle(...handles: Handle[]): Handle {
  return createHandle(() => {
    handles.forEach(handle => handle.destroy());
  });
}

/**
 * Deeply mix the properties of two objects
 */
export function deepMixin<T extends object, U extends object>(
  target: T,
  source: U
): T & U;
export function deepMixin<T extends object, U extends object, V extends object>(
  target: T,
  source1: U,
  source2: V
): T & U & V;
export function deepMixin(target: object, ...sources: object[]): object {
  return _deepMixin({
    sources: sources,
    target: target
  });
}

/**
 * Creates a new object using the provided source's prototype as the prototype
 * for the new object, and then deep copies the provided source's values into
 * the new target.
 *
 * @param source the object to duplicate
 */
export function duplicate<T extends object>(source: T): T {
  const target = Object.create(Object.getPrototypeOf(source));
  return deepMixin(target, source);
}

/**
 * Returns a function which invokes the given function with the given arguments
 * prepended to its argument list. Like `Function.prototype.bind`, but does not
 * alter execution context.
 *
 * @param targetFunction The function that needs to be bound
 * @param suppliedArgs An optional array of arguments to prepend to the
 * `targetFunction` arguments list
 */
export function partial(
  targetFunction: (...args: any[]) => any,
  ...suppliedArgs: any[]
): (...args: any[]) => any {
  return function(this: any) {
    const args: any[] = arguments.length
      ? suppliedArgs.concat(Array.prototype.slice.call(arguments))
      : suppliedArgs;

    return targetFunction.apply(this, args);
  };
}

// support functions ----------------------------------------------------------

function copyArray<T>(array: T[]): T[] {
  return array.map(function(item: T): T {
    if (Array.isArray(item)) {
      return <any>copyArray(<any>item);
    }

    return !shouldDeepCopyObject(item)
      ? item
      : _deepMixin({ sources: [item], target: {} });
  });
}

function shouldDeepCopyObject(value: any): value is Object {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function _deepMixin<T extends {}, U extends {}>(kwArgs: {
  sources: (U | null | undefined)[];
  target: T;
  copied?: any[];
}): T & U {
  const target: any = kwArgs.target;
  const copied = kwArgs.copied || [];
  const copiedClone = [...copied];

  for (let i = 0; i < kwArgs.sources.length; i++) {
    const source = kwArgs.sources[i];

    if (source === null || source === undefined) {
      continue;
    }
    for (let key in source) {
      let value: any = source[key];

      if (copiedClone.indexOf(value) !== -1) {
        continue;
      }

      if (Array.isArray(value)) {
        value = copyArray(value);
      } else if (shouldDeepCopyObject(value)) {
        const targetValue: any = target[key] || {};
        copied.push(source);
        value = _deepMixin({
          sources: [value],
          target: targetValue,
          copied
        });
      }

      target[key] = value;
    }
  }

  return <T & U>target;
}

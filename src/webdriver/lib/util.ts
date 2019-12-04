import { Task, CancellablePromise } from '../../common';

/**
 * Creates a promise that resolves itself after `ms` milliseconds.
 *
 * @param ms Time until resolution in milliseconds.
 */
export function sleep(ms: number): CancellablePromise<void> {
  let timer: NodeJS.Timer;
  return new Task<void>(
    function(resolve) {
      timer = setTimeout(() => {
        resolve();
      }, ms);
    },
    () => clearTimeout(timer)
  );
}

/**
 * Annotates the method with additional properties that provide guidance to
 * [[Command]] about how the method interacts with stored context elements.
 */
export function forCommand(
  fn: Function,
  properties: { usesElement?: boolean; createsContext?: boolean }
): Function {
  return Object.assign(fn, properties);
}

/**
 * Get method names, including inherited methods, on an object
 */
export function getMethods(obj: object) {
  return getOwnProperties(obj).filter(
    name => typeof (<any>obj)[name] === 'function'
  );
}

/**
 * Get all property names for an object, including non-enumerable properties
 */
export function getOwnProperties(obj: Object): string[] {
  if (obj === Object.prototype) {
    return [];
  }
  return [
    ...Object.getOwnPropertyNames(obj).filter(
      name => name !== 'constructor' && name.indexOf('__') !== 0
    ),
    ...getOwnProperties(Object.getPrototypeOf(obj))
  ];
}

/**
 * Searches a document or element subtree for links with the given
 * normalized text. This method works for 'link text' and 'partial link
 * text' search strategies.
 *
 * Note that this method should be passed to an `execute` call, not called
 * directly. It has an 'istanbul ignore' comment for this reason.
 *
 * @param using The strategy in use ('link text' or 'partial link text')
 * @param value The link text to search for
 * @param multiple If true, return all matching links
 * @param element A context element
 * @returns The found element or elements
 */
/* istanbul ignore next */
export function manualFindByLinkText(
  using: string,
  value: string,
  multiple: boolean,
  element?: HTMLElement
) {
  const check =
    using === 'link text'
      ? function(linkText: string, text: string) {
          return linkText === text;
          // tslint:disable-next-line:indent
        }
      : function(linkText: string, text: string) {
          return linkText.indexOf(text) !== -1;
          // tslint:disable-next-line:indent
        };

  const links = (element || document).getElementsByTagName('a');
  let linkText: string;
  const found: HTMLElement[] = [];

  for (let i = 0; i < links.length; i++) {
    // Normalize the link text whitespace
    linkText = links[i].innerText
      .replace(/^\s+/, '')
      .replace(/\s+$/, '')
      .replace(/\s*\r\n\s*/g, '\n')
      .replace(/ +/g, ' ');
    if (check(linkText, value)) {
      if (!multiple) {
        return links[i];
      }
      found.push(links[i]);
    }
  }

  if (multiple) {
    return found;
  }
}

/**
 * Converts a function to a string representation suitable for use with the
 * `execute` API endpoint.
 */
export function toExecuteString(fn: Function | string): string {
  if (typeof fn === 'function') {
    // If someone runs code through Istanbul in the test runner, inline
    // functions that are supposed to execute on the client will contain
    // code coverage variables that will cause script execution failure.
    // These statements are very simple and are generated in a consistent
    // manner, so we can get rid of them easily with a regular expression
    fn = fn.toString().replace(/\b__cov_[^,;]+[,;]/g, '');
    fn = 'return (' + fn + ').apply(this, arguments);';
  }

  return fn;
}

/**
 * Removes the first line of a stack trace, which in V8 is the string
 * representation of the object holding the stack trace (which is garbage for
 * captured stack traces).
 */
export function trimStack(stack: string): string {
  return stack.replace(/^[^\n]+/, '');
}

import { getMethods, sleep, trimStack } from './lib/util';
import Element from './Element';
import { Task, CancellablePromise } from '../common';
import Session from './Session';
import Locator, { Strategy } from './lib/Locator';
import { LogEntry, Geolocation, WebDriverCookie } from './interfaces';

/**
 * The Command class is a chainable, subclassable object type that can be used
 * to execute commands serially against a remote WebDriver environment. The
 * standard Command class includes methods from the [[Session]] and [[Element]]
 * classes, so you can perform all standard session and element operations that
 * come with Leadfoot without being forced to author long promise chains.
 *
 * In order to use the Command class, you first need to pass it a [[Session]]
 * instance for it to use:
 *
 * ```js
 * const command = new Command(session);
 * ```
 *
 * Once you have created the Command, you can then start chaining methods, and
 * they will execute in order one after another:
 *
 * ```js
 * command.get('http://example.com')
 *     .findByTagName('h1')
 *     .getVisibleText()
 *     .then(function (text) {
 *         assert.strictEqual(text, 'Example Domain');
 *     });
 * ```
 *
 * Because these operations are asynchronous, you need to use a `then` callback
 * in order to retrieve the value from the last method. Command objects are
 * PromiseLikes, which means that they can be used with any Promises/A+ or
 * ES6-conformant Promises implementation, though there are some specific
 * differences in the arguments and context that are provided to callbacks; see
 * [[Command.Command.then]] for more details.
 *
 * Because Commands are promise-like, they may also be used with `async/await`:
 *
 * ```js
 * const page = await command.get('http://example.com');
 * const h1 = await page.findByTagName('h1');
 * const text = await h1.getVisibleText();
 * assert.strictEqual(text, 'Example Domain');
 * ```
 *
 * ---
 *
 * Each call on a Command generates a new Command object, which means that
 * certain operations can be parallelised:
 *
 * ```js
 * command = command.get('http://example.com');
 * Promise.all([
 *     command.getPageTitle(),
 *     command.findByTagName('h1').getVisibleText()
 * ]).then(results => {
 *     assert.strictEqual(results[0], results[1]);
 * });
 * ```
 *
 * In this example, the commands on line 3 and 4 both depend upon the `get`
 * call completing successfully but are otherwise independent of each other and
 * so execute here in parallel. This is different from commands in Intern 1
 * which were always chained onto the last called method within a given test.
 *
 * ---
 *
 * Command objects actually encapsulate two different types of interaction:
 * *session* interactions, which operate against the entire browser session,
 * and *element* interactions, which operate against specific elements taken
 * from the currently loaded page. Things like navigating the browser, moving
 * the mouse cursor, and executing scripts are session interactions; things
 * like getting text displayed on the page, typing into form fields, and
 * getting element attributes are element interactions.
 *
 * Session interactions can be performed at any time, from any Command. On the
 * other hand, to perform element interactions, you first need to retrieve one
 * or more elements to interact with. This can be done using any of the `find`
 * or `findAll` methods, by the `getActiveElement` method, or by returning
 * elements from `execute` or `executeAsync` calls. The retrieved elements are
 * stored internally as the *element context* of all chained Commands. When an
 * element method is called on a chained Command with a single element context,
 * the result will be returned as-is:
 *
 * ```js
 * command = command.get('http://example.com')
 *     // finds one element -> single element context
 *     .findByTagName('h1')
 *     .getVisibleText()
 *     .then(text => {
 *         // `text` is the text from the element context
 *         assert.strictEqual(text, 'Example Domain');
 *     });
 * ```
 *
 * When an element method is called on a chained Command with a multiple
 * element context, the result will be returned as an array:
 *
 * ```js
 * command = command.get('http://example.com')
 *     // finds multiple elements -> multiple element context
 *     .findAllByTagName('p')
 *     .getVisibleText()
 *     .then(texts => {
 *         // `texts` is an array of text from each of the `p` elements
 *         assert.deepEqual(texts, [
 *             'This domain is established to be used for […]',
 *             'More information...'
 *         ]);
 *     });
 * ```
 *
 * The `find` and `findAll` methods are special and change their behaviour
 * based on the current element filtering state of a given command. If a
 * command has been filtered by element, the `find` and `findAll` commands will
 * only find elements *within* the currently filtered set of elements.
 * Otherwise, they will find elements throughout the page.
 *
 * Some method names, like `click`, are identical for both Session and Element
 * APIs; in this case, the element APIs are suffixed with the word `Element` in
 * order to identify them uniquely.
 *
 * ---
 *
 * Commands can be subclassed in order to add additional functionality without
 * making direct modifications to the default Command prototype that might
 * break other parts of the system:
 *
 * ```ts
 * class CustomCommand extends Command {
 *     login(username: string, password: string) {
 *         return new this.constructor(this, function () {
 *             return this.parent
 *                 .findById('username')
 *                 .click()
 *                 .type(username)
 *                 .end()
 *
 *                 .findById('password')
 *                 .click()
 *                 .type(password)
 *                 .end()
 *
 *                 .findById('login')
 *                 .click()
 *                 .end();
 *         });
 *     }
 * }
 * ```
 *
 * >  ⚠️Note that returning `this`, or a command chain starting from `this`,
 * from a callback or command initialiser will deadlock the Command, as it
 * waits for itself to settle before settling.
 */
export default class Command<
  T,
  P = any,
  StringResult extends string | string[] = string
>
  // T is the type this Command resolves to
  // P is the type its parent Command resolves to
  // StringResult is the type that any string-returning operations will resolve
  // to
  extends Locator<
    Command<Element, P, string>,
    Command<Element[], P, string[]>,
    Command<void, P, StringResult>
  >
  implements PromiseLike<T> {
  /**
   * Augments `target` with a conversion of the `originalFn` method that
   * enables its use with a Command object. This can be used to easily add
   * new methods from any custom object that implements the Session API to
   * any target object that implements the Command API.
   *
   * Functions that are copied may have the following extra properties in
   * order to change the way that Command works with these functions:
   *
   * * `createsContext` (boolean): If this property is specified, the return
   *   value from the function will be used as the new context for the
   *   returned Command.
   * * `usesElement` (boolean): If this property is specified, element(s)
   *   from the current context will be used as the first argument to the
   *   function, if the explicitly specified first argument is not already an
   *   element.
   *
   * @param {module:leadfoot/Command} target
   * @param {string} key
   * @param {Function} originalFn
   */
  static addSessionMethod<Us, Ps, Ss extends string | string[]>(
    target: Command<Us, Ps, Ss>,
    key: string,
    originalFn: Function
  ) {
    // Checking for private/non-functions here deduplicates this logic;
    // otherwise it would need to exist in both the Command constructor
    // (for copying functions from sessions) as well as the Command factory
    // below
    if (
      key.charAt(0) !== '_' &&
      !(<any>target)[key] &&
      typeof originalFn === 'function'
    ) {
      // Regarding typing, <U, P, S> is the generic type of the Command that
      // will be created. <P, any, S> is the type of *this* command, which will
      // be the parent of the created Command.
      (<any>target)[key] = function(
        this: Command<Ps, any, Ss>,
        ...args: any[]
      ): Command<Us, Ps, Ss> {
        return new (this.constructor as typeof Command)<Us, Ps, Ss>(
          this,
          function(this, setContext: SetContextMethod) {
            const parentContext = this._context;
            const session = this._session;
            let promise: CancellablePromise<any>;
            // The function may have come from a session object
            // prototype but have been overridden on the actual session
            // instance; in such a case, the overridden function should
            // be used instead of the one from the original source
            // object. The original source object may still be used,
            // however, if the function is being added like a mixin and
            // does not exist on the actual session object for this
            // session
            const fn = (<any>session)[key] || originalFn;

            if (
              fn.usesElement &&
              parentContext.length &&
              (!args[0] || !args[0].elementId)
            ) {
              // Defer converting arguments into an array until it is
              // necessary to avoid overhead
              args = Array.prototype.slice.call(args, 0);

              if (parentContext.isSingle) {
                promise = fn.apply(session, [parentContext[0]].concat(args));
              } else {
                promise = Task.all(
                  parentContext.map((element: Element) =>
                    fn.apply(session, [element].concat(args))
                  )
                );
              }
            } else {
              promise = fn.apply(session, args);
            }

            if (fn.createsContext) {
              promise = promise.then(function(newContext) {
                setContext(newContext);
                return newContext;
              });
            }

            return <CancellablePromise<Us>>promise;
          }
        );
      };
    }
  }

  /**
   * Augments `target` with a method that will call `key` on all context
   * elements stored within `target`. This can be used to easily add new
   * methods from any custom object that implements the Element API to any
   * target object that implements the Command API.
   *
   * Functions that are copied may have the following extra properties in
   * order to change the way that Command works with these functions:
   *
   * * `createsContext` (boolean): If this property is specified, the return
   *   value from the function will be used as the new context for the
   *   returned Command.
   *
   * @param {module:leadfoot/Command} target
   * @param {string} key
   */
  static addElementMethod<Us, Ps, Ss extends string | string[]>(
    target: Command<Us, Ps, Ss>,
    key: string
  ) {
    const anyTarget = <any>target;
    if (key.charAt(0) !== '_') {
      // some methods, like `click`, exist on both Session and Element;
      // deduplicate these methods by appending the element ones with
      // 'Element'
      const targetKey = key + (anyTarget[key] ? 'Element' : '');
      anyTarget[targetKey] = function(
        this: Command<Ps, any, Ss>,
        ...args: any[]
      ): Command<Us, Ps, Ss> {
        return new (this.constructor as typeof Command)<Us, Ps, Ss>(
          this,
          function(setContext: SetContextMethod) {
            const parentContext = this._context;
            let promise: CancellablePromise<any>;
            let fn = (<any>parentContext)[0] && (<any>parentContext)[0][key];

            if (parentContext.isSingle) {
              promise = fn.apply(parentContext[0], args);
            } else {
              promise = Task.all(
                parentContext.map(function(element: any) {
                  return element[key].apply(element, args);
                })
              );
            }

            if (fn && fn.createsContext) {
              promise = promise.then(function(newContext) {
                setContext(newContext);
                return newContext;
              });
            }

            return <CancellablePromise<Us>>promise;
          }
        );
      };
    }
  }

  private _parent: Command<P, any, StringResult> | undefined;
  private _session: Session;
  private _context!: Context;
  private _task: CancellablePromise<any>;

  /**
   * @param parent The parent command that this command is chained to, or a
   * [[Sesssion]] object if this is the first command in a command chain.
   *
   * @param initialiser A function that will be executed when all parent
   * commands have completed execution. This function can create a new
   * context for this command by calling the passed `setContext` function any
   * time prior to resolving the Promise that it returns. If no context is
   * explicitly provided, the context from the parent command will be used.
   *
   * @param errback A function that will be executed if any parent commands
   * failed to complete successfully. This function can create a new context
   * for the current command by calling the passed `setContext` function any
   * time prior to resolving the Promise that it returns. If no context is
   * explicitly provided, the context from the parent command will be used.
   */
  // TODO: Need to show that parent is mixed into this Command
  constructor(
    parentOrSession: Session | Command<P, any, StringResult> | null,
    initialiser?: (
      this: Command<T, P, StringResult>,
      setContext: SetContextMethod,
      value: T
    ) => T | PromiseLike<T>,
    errback?: (
      this: Command<T, P, StringResult>,
      setContext: SetContextMethod,
      error: any
    ) => T | PromiseLike<T>
  ) {
    super();

    const self = this;
    let session: Session;
    const trace: any = {};

    function setContext(contextValue: Element | Element[]) {
      let context: Context;
      if (!Array.isArray(contextValue)) {
        context = <Context>[contextValue];
        context.isSingle = true;
      } else {
        context = contextValue;
      }

      const parent = <Command<P, any, StringResult>>parentOrSession;

      // If the context being set has depth, then it is coming from
      // `Command#end`, or someone smart knows what they are doing; do
      // not change the depth
      if (!('depth' in context)) {
        context.depth = parent ? parent.context.depth! + 1 : 0;
      }

      self._context = context;
    }

    function fixStack(error: Error) {
      error.stack = error.stack + trimStack(trace.stack);
      throw error;
    }

    if (parentOrSession instanceof Command) {
      this._parent = parentOrSession;
      session = this._session = parentOrSession.session;
    } else if (parentOrSession instanceof Session) {
      session = this._session = parentOrSession;
      parentOrSession = null;
    } else {
      throw new Error(
        'A parent Command or Session must be provided to a new Command'
      );
    }

    // Add any custom functions from the session to this command object so
    // they can be accessed automatically using the fluid interfaces
    // TODO: Test
    getMethods(session).forEach(name => {
      const key = <keyof Session>name;
      if (session[key] !== Session.prototype[key]) {
        Command.addSessionMethod(this, key, (<any>session)[key]);
      }
    });

    Error.captureStackTrace(trace, Command);

    // parentCommand will be null if parentOrSession was a session
    let parentCommand = <Command<P, any, StringResult>>parentOrSession;
    this._task = (parentCommand
      ? parentCommand.promise
      : Task.resolve(undefined)
    )
      .then(
        function(returnValue) {
          self._context = parentCommand ? parentCommand.context : TOP_CONTEXT;
          return returnValue;
        },
        function(error) {
          self._context = parentCommand ? parentCommand.context : TOP_CONTEXT;
          throw error;
        }
      )
      .then(
        initialiser &&
          function(returnValue) {
            return Task.resolve(returnValue)
              .then(initialiser.bind(self, setContext))
              .catch(fixStack);
          },
        errback &&
          function(error) {
            return Task.reject(error)
              .catch(errback.bind(self, setContext))
              .catch(fixStack);
          }
      );
  }

  /**
   * The parent Command of the Command, if one exists. This will be defined
   * for all commands but the top-level Session command (i.e., in most
   * contexts user code will call it).
   */
  get parent() {
    return this._parent!;
  }

  /**
   * The parent Session of the Command.
   */
  get session() {
    return this._session;
  }

  /**
   * The filtered elements that will be used if an element-specific method is
   * invoked. Note that this property is not valid until the parent Command
   * has been settled. The context array also has two additional properties:
   *
   * * `isSingle` (boolean): If true, the context will always contain a
   *   single element. This is used to differentiate between methods that
   *   should still return scalar values (`find`) and methods that should
   *   return arrays of values even if there is only one element in the
   *   context (`findAll`).
   * * `depth` (number): The depth of the context within the command chain.
   *   This is used to prevent traversal into higher filtering levels by
   *   [[Command.Command.end]].
   */
  get context() {
    return this._context;
  }

  /**
   * The underlying Promise for the Command.
   *
   * @readonly
   */
  get promise() {
    return this._task;
  }

  /**
   * Pauses execution of the next command in the chain for `ms` milliseconds.
   *
   * @param ms Time to delay, in milliseconds.
   */
  sleep(ms: number): Command<void, P, StringResult> {
    return new (this.constructor as typeof Command)<void, any, StringResult>(
      this,
      function() {
        return sleep(ms);
      }
    );
  }

  /**
   * Ends the most recent filtering operation in the current Command chain
   * and returns the set of matched elements to the previous state. This is
   * equivalent to the `jQuery#end` method.
   *
   * ```js
   * command
   *     .findById('parent') // sets filter to #parent
   *     .findByClassName('child') // sets filter to all .child inside #parent
   *     .getVisibleText()
   *     .then(function (visibleTexts) {
   *         // all the visible texts from the children
   *     })
   *     .end() // resets filter to #parent
   *     .end(); // resets filter to nothing (the whole document)
   *  ```
   *
   * @param numCommandsToPop The number of element contexts to pop. Defaults
   * to 1.
   */
  end(numCommandsToPop: number = 1): Command<void, P, StringResult> {
    return new (this.constructor as typeof Command)<void, any, StringResult>(
      this,
      function(setContext: Function) {
        let command: Command<any, any, StringResult> | undefined = this;
        let depth: number | undefined = this.context.depth;

        while (depth && numCommandsToPop && (command = command.parent)) {
          if (command.context.depth != null && command.context.depth < depth) {
            --numCommandsToPop;
            depth = command.context.depth;
          }
        }

        setContext(command!.context);
      }
    );
  }

  /**
   * Adds a callback to be invoked once the previously chained operation has
   * completed.
   *
   * This method is compatible with the `Promise#then` API, with two
   * important differences:
   *
   * 1. The context (`this`) of the callback is set to the Command object,
   *    rather than being `undefined`. This allows promise helpers to be
   *    created that can retrieve the appropriate session and element
   *    contexts for execution.
   * 2. A second non-standard `setContext` argument is passed to the
   *    callback. This `setContext` function can be called at any time before
   *    the callback fulfills its return value and expects either a single
   *    [[Element]] or an array of Elements to be provided as its only
   *    argument. The provided element(s) will be used as the context for
   *    subsequent element method invocations (`click`, etc.). If the
   *    `setContext` method is not called, the element context from the
   *    parent will be passed through unmodified.
   */
  then<U = T, R = never>(
    callback?:
      | ((
          this: Command<T, P, StringResult>,
          value: T,
          setContext: SetContextMethod
        ) => U | PromiseLike<U>)
      | null
      | undefined,
    errback?:
      | ((this: Command<T, P, StringResult>, error: any) => R | PromiseLike<R>)
      | null
      | undefined
  ): Command<U | R, T, StringResult> {
    function runCallback(
      newCommand: Command<T, P, StringResult>,
      callback: (
        this: Command<T, P, StringResult>,
        value: T,
        setContext: SetContextMethod
      ) => U | PromiseLike<U>,
      errback: undefined,
      value: U,
      setContext: SetContextMethod
    ): U | PromiseLike<U>;
    // PromiseLike#then says its error callback can return a different type
    // than the success callback, whereas the Command constructor says its
    // error callback will return the same type as the success callback. To
    // make Command happy, say the errback version of runCallback will return
    // something of type U | PromiseLike<U>.
    function runCallback(
      newCommand: Command<T, P, StringResult>,
      callback: undefined,
      errback: (
        this: Command<T, P, StringResult>,
        error: any
      ) => R | PromiseLike<R>,
      value: any,
      setContext: SetContextMethod
    ): R | PromiseLike<R>;
    function runCallback(
      newCommand: Command<T, P, StringResult>,
      callback:
        | undefined
        | ((
            this: Command<T, P, StringResult>,
            value: T,
            setContext: SetContextMethod
          ) => U | PromiseLike<U>),
      errback:
        | undefined
        | ((
            this: Command<T, P, StringResult>,
            error: any
          ) => R | PromiseLike<R>),
      value: any,
      setContext: SetContextMethod
    ) {
      const returnValue = callback
        ? callback.call(newCommand, (value as unknown) as T, setContext)
        : errback!.call(newCommand, value);

      // If someone returns `this` (or a chain starting from `this`) from
      // the callback, it will cause a deadlock where the child command
      // is waiting for the child command to resolve
      if (returnValue instanceof Command) {
        // maybeCommand can be a Session or a Command, both of which
        // inherit from Locator
        let maybeCommand:
          | Command<any, any, StringResult>
          | Session
          | undefined = returnValue;
        do {
          if (maybeCommand === newCommand) {
            throw new Error(
              'Deadlock: do not use `return this` from a Command callback'
            );
          }
        } while ((maybeCommand = getParent<StringResult>(maybeCommand)));
      }

      return returnValue;
    }

    return new (this.constructor as typeof Command)(
      this,
      callback
        ? function(setContext: SetContextMethod, value: U) {
            return runCallback(
              (this as unknown) as Command<T, P, StringResult>,
              callback,
              undefined,
              value,
              setContext
            );
          }
        : undefined,
      errback
        ? function(setContext: SetContextMethod, value: any) {
            return (runCallback(
              (this as unknown) as Command<T, P, StringResult>,
              undefined,
              errback,
              value,
              setContext
            ) as unknown) as U | PromiseLike<U>;
          }
        : undefined
    );
  }

  /**
   * Adds a callback to be invoked when any of the previously chained
   * operations have failed.
   */
  catch<R = never>(
    errback: (
      this: Command<T, P, StringResult>,
      reason: any
    ) => R | PromiseLike<R>
  ) {
    return this.then(null, errback);
  }

  /**
   * Adds a callback to be invoked once the previously chained operations
   * have resolved.
   */
  finally(callback: () => void) {
    this._task = this._task.finally(callback);
    return this;
  }

  /**
   * Cancels all outstanding chained operations of the Command. Calling this
   * method will cause this command and all subsequent chained commands to
   * fail with a CancelError.
   */
  cancel() {
    this._task.cancel();
    return this;
  }

  find(strategy: Strategy, value: string) {
    return this._callFindElementMethod('find', strategy, value);
  }

  findAll(strategy: Strategy, value: string) {
    return this._callFindElementMethod('findAll', strategy, value);
  }

  findDisplayed(strategy: Strategy, value: string) {
    return this._callFindElementMethod('findDisplayed', strategy, value);
  }

  /**
   * a function that, when called, creates a new Command that retrieves
   * elements from the parent context and uses them as the context for the
   * newly created Command.
   */
  private _callFindElementMethod(
    method: 'find' | 'findDisplayed',
    strategy: Strategy,
    value: string
  ): Command<Element, P, string>;
  private _callFindElementMethod(
    method: 'findAll',
    strategy: Strategy,
    value: string
  ): Command<Element[], P, string[]>;
  private _callFindElementMethod(
    method: 'find' | 'findAll' | 'findDisplayed',
    strategy: Strategy,
    value: string
  ): Command<Element, P, string> | Command<Element[], P, string[]> {
    return new (this.constructor as typeof Command)<any, any, any>(
      this,
      function(setContext: SetContextMethod) {
        const parentContext = this._context;
        let task: CancellablePromise<Element | Element[]>;

        if (parentContext.length && parentContext.isSingle) {
          task = parentContext[0][method](strategy, value);
        } else if (parentContext.length) {
          task = Task.all(
            parentContext.map(element => element[method](strategy, value))
            // findAll against an array context will result in arrays
            // of arrays; flatten into a single array of elments. It
            // would also be possible to resort in document order but
            // other parallel operations could not be sorted so we just
            // don't do it anywhere and say not to rely on a particular
            // order for results
          ).then(elements => Array.prototype.concat.apply([], elements));
        } else {
          task = this.session[method](strategy, value);
        }

        return task.then(newContext => {
          setContext(newContext);
          return newContext;
        });
      }
    );
  }

  private _callElementMethod<U>(
    method: keyof Element,
    ...args: any[]
  ): Command<U, P, StringResult> {
    return new (this.constructor as typeof Command)<U, any, StringResult>(
      this,
      function(setContext: SetContextMethod) {
        const parentContext = this._context;
        let task: CancellablePromise<U>;
        let fn = parentContext[0] && parentContext[0][method];

        if (parentContext.isSingle) {
          task = fn.apply(parentContext[0], args);
        } else {
          task = (Task.all(
            parentContext.map(element => (element[method] as Function)(...args))
          ).then(values =>
            Array.prototype.concat.apply([], values)
          ) as unknown) as CancellablePromise<U>;
        }

        if (fn && fn.createsContext) {
          task = task.then(function(newContext) {
            setContext(<any>newContext);
            return newContext;
          });
        }

        return task;
      }
    );
  }

  private _callSessionMethod<U>(
    method: keyof Session,
    ...args: any[]
  ): Command<U, P, StringResult> {
    return new (this.constructor as typeof Command)<U, any, StringResult>(
      this,
      function(setContext: SetContextMethod) {
        const parentContext = this._context;
        const session = this._session;
        let task: CancellablePromise<U>;

        // The function may have come from a session object prototype but
        // have been overridden on the actual session instance; in such a
        // case, the overridden function should be used instead of the one
        // from the original source object. The original source object may
        // still be used, however, if the function is being added like a
        // mixin and does not exist on the actual session object for this
        // session
        const sessionMethod = (...args: any[]) => {
          return (<Function>session[method])(...args);
        };

        if (
          (<any>session[method]).usesElement &&
          parentContext.length &&
          (!args[0] || !args[0].elementId)
        ) {
          if (parentContext.isSingle) {
            task = sessionMethod(...[parentContext[0], ...args]);
          } else {
            task = (Task.all(
              parentContext.map(element => sessionMethod(...[element, ...args]))
            ).then(values =>
              Array.prototype.concat.apply([], values)
            ) as unknown) as CancellablePromise<U>;
          }
        } else {
          task = sessionMethod(...args);
        }

        if ((<any>session[method]).createsContext) {
          task = task.then(newContext => {
            setContext(<any>newContext);
            return newContext;
          });
        }

        return task;
      }
    );
  }

  // Session methods

  /**
   * Gets the current value of a timeout for the session.
   *
   * @param type The type of timeout to retrieve. One of 'script',
   * 'implicit', or 'page load'.
   * @returns The timeout, in milliseconds.
   */
  getTimeout(type: string) {
    return this._callSessionMethod<number>('getTimeout', type);
  }

  /**
   * Sets the value of a timeout for the session.
   *
   * @param type The type of timeout to set. One of 'script', 'implicit', or
   * 'page load'.
   *
   * @param ms The length of time to use for the timeout, in milliseconds. A
   * value of 0 will cause operations to time out immediately.
   */
  setTimeout(type: string, ms: number) {
    return this._callSessionMethod<void>('setTimeout', type, ms);
  }

  /**
   * Gets the identifier for the window that is currently focused.
   *
   * @returns A window handle identifier that can be used with other window
   * handling functions.
   */
  getCurrentWindowHandle() {
    return this._callSessionMethod<string>('getCurrentWindowHandle');
  }

  /**
   * Gets a list of identifiers for all currently open windows.
   */
  getAllWindowHandles() {
    return this._callSessionMethod<string[]>('getAllWindowHandles');
  }

  /**
   * Gets the URL that is loaded in the focused window/frame.
   */
  getCurrentUrl() {
    return this._callSessionMethod<string>('getCurrentUrl');
  }

  /**
   * Navigates the focused window/frame to a new URL.
   */
  get(url: string) {
    return this._callSessionMethod<void>('get', url);
  }

  /**
   * Navigates the focused window/frame forward one page using the browser’s
   * navigation history.
   */
  goForward() {
    return this._callSessionMethod<void>('goForward');
  }

  /**
   * Navigates the focused window/frame back one page using the browser’s
   * navigation history.
   */
  goBack() {
    return this._callSessionMethod<void>('goBack');
  }

  /**
   * Reloads the current browser window/frame.
   */
  refresh() {
    return this._callSessionMethod<void>('refresh');
  }

  /**
   * Executes JavaScript code within the focused window/frame. The code
   * should return a value synchronously.
   *
   * See [[Command.Command.executeAsync]] to execute code that returns values
   * asynchronously.
   *
   * @param script The code to execute. This function will always be
   * converted to a string, sent to the remote environment, and reassembled
   * as a new anonymous function on the remote end. This means that you
   * cannot access any variables through closure. If your code needs to get
   * data from variables on the local end, they should be passed using
   * `args`.
   *
   * @param args An array of arguments that will be passed to the executed
   * code. Only values that can be serialised to JSON, plus [[Element]]
   * objects, can be specified as arguments.
   *
   * @returns The value returned by the remote code. Only values that can be
   * serialised to JSON, plus DOM elements, can be returned.
   */
  execute<T = any>(script: Function | string, args?: any[]) {
    return this._callSessionMethod<T>('execute', script, args);
  }

  /**
   * Executes JavaScript code within the focused window/frame. The code must
   * invoke the provided callback in order to signal that it has completed
   * execution.
   *
   * See [[Command.Command.execute]] to execute code that returns values
   * synchronously.
   *
   * See [[Command.Command.setExecuteAsyncTimeout]] to set the time until an
   * asynchronous script is considered timed out.
   *
   * @param script The code to execute. This function will always be
   * converted to a string, sent to the remote environment, and reassembled
   * as a new anonymous function on the remote end. This means that you
   * cannot access any variables through closure. If your code needs to get
   * data from variables on the local end, they should be passed using
   * `args`.
   *
   * @param args An array of arguments that will be passed to the executed
   * code. Only values that can be serialised to JSON, plus [[Element]]
   * objects, can be specified as arguments. In addition to these arguments,
   * a callback function will always be passed as the final argument to the
   * function specified in `script`. This callback function must be invoked
   * in order to signal that execution has completed. The return value of the
   * execution, if any, should be passed to this callback function.
   *
   * @returns The value returned by the remote code. Only values that can be
   * serialised to JSON, plus DOM elements, can be returned.
   */
  executeAsync<T = any>(script: Function | string, args?: any[]) {
    return this._callSessionMethod<T>('executeAsync', script, args);
  }

  /**
   * Gets a screenshot of the focused window and returns it in PNG format.
   */
  takeScreenshot() {
    return this._callSessionMethod<Buffer>('takeScreenshot');
  }

  /**
   * Gets a list of input method editor engines available to the remote
   * environment. As of April 2014, no known remote environments support IME
   * functions.
   */
  getAvailableImeEngines() {
    return this._callSessionMethod<string[]>('getAvailableImeEngines');
  }

  /**
   * Gets the currently active input method editor for the remote environment.
   * As of April 2014, no known remote environments support IME functions.
   */
  getActiveImeEngine() {
    return this._callSessionMethod<string>('getActiveImeEngine');
  }

  /**
   * Returns whether or not an input method editor is currently active in the
   * remote environment. As of April 2014, no known remote environments
   * support IME functions.
   */
  isImeActivated() {
    return this._callSessionMethod<boolean>('isImeActivated');
  }

  /**
   * Deactivates any active input method editor in the remote environment.
   * As of April 2014, no known remote environments support IME functions.
   */
  deactivateIme() {
    return this._callSessionMethod<void>('deactivateIme');
  }

  /**
   * Activates an input method editor in the remote environment.
   * As of April 2014, no known remote environments support IME functions.
   *
   * @param engine The type of IME to activate.
   */
  activateIme(engine: string) {
    return this._callSessionMethod<void>('activateIme', engine);
  }

  /**
   * Switches the currently focused frame to a new frame.
   *
   * @param id The frame to switch to. In most environments, a number or
   * string value corresponds to a key in the `window.frames` object of the
   * currently active frame. If `null`, the topmost (default) frame will be
   * used. If an Element is provided, it must correspond to a `<frame>` or
   * `<iframe>` element.
   */
  switchToFrame(id: string | number | Element | null) {
    return this._callSessionMethod<void>('switchToFrame', id);
  }

  /**
   * Switches the currently focused window to a new window.
   *
   * In environments using the JsonWireProtocol, this value corresponds to
   * the `window.name` property of a window.
   *
   * @param handle The handle of the window to switch to. In mobile
   * environments and environments based on the W3C WebDriver standard, this
   * should be a handle as returned by
   * [[Command.Command.getAllWindowHandles]].
   */
  switchToWindow(handle: string) {
    return this._callSessionMethod<void>('switchToWindow', handle);
  }

  /**
   * Switches the currently focused frame to the parent of the currently
   * focused frame.
   */
  switchToParentFrame() {
    return this._callSessionMethod<void>('switchToParentFrame');
  }

  /**
   * Closes the currently focused window. In most environments, after the
   * window has been closed, it is necessary to explicitly switch to whatever
   * window is now focused.
   */
  closeCurrentWindow() {
    return this._callSessionMethod<void>('closeCurrentWindow');
  }

  /**
   * Sets the dimensions of a window.
   *
   * @param windowHandle The name of the window to resize. See
   * [[Command.Command.switchToWindow]] to learn about valid window names.
   * Omit this argument to resize the currently focused window.
   *
   * @param width The new width of the window, in CSS pixels.
   *
   * @param height The new height of the window, in CSS pixels.
   */
  setWindowSize(width: number, height: number): Command<void, P, StringResult>;
  setWindowSize(
    windowHandle: string,
    width: number,
    height: number
  ): Command<void, P, StringResult>;
  setWindowSize(...args: any[]) {
    return this._callSessionMethod<void>('setWindowSize', ...args);
  }

  /**
   * Gets the dimensions of a window.
   *
   * @param windowHandle The name of the window to query. See
   * [[Command.Command.switchToWindow]] to learn about valid window names.
   * Omit this argument to query the currently focused window.
   *
   * @returns An object describing the width and height of the window, in CSS
   * pixels.
   */
  getWindowSize(_windowHandle?: string) {
    return this._callSessionMethod<{ width: number; height: number }>(
      'getWindowSize'
    );
  }

  /**
   * Sets the position of a window.
   *
   * Note that this method is not part of the W3C WebDriver standard.
   *
   * @param windowHandle The name of the window to move. See
   * [[Command.Command.switchToWindow]] to learn about valid window names.
   * Omit this argument to move the currently focused window.
   *
   * @param x The screen x-coordinate to move to, in CSS pixels, relative to
   * the left edge of the primary monitor.
   *
   * @param y The screen y-coordinate to move to, in CSS pixels, relative to
   * the top edge of the primary monitor.
   */
  setWindowPosition(x: number, y: number): Command<void, P, StringResult>;
  setWindowPosition(
    windowHandle: string,
    x: number,
    y: number
  ): Command<void, P, StringResult>;
  setWindowPosition(...args: any[]) {
    return this._callSessionMethod<void>('setWindowPosition', ...args);
  }

  /**
   * Gets the position of a window.
   *
   * Note that this method is not part of the W3C WebDriver standard.
   *
   * @param windowHandle The name of the window to query. See
   * [[Command.Command.switchToWindow]] to learn about valid window names.
   * Omit this argument to query the currently focused window.
   *
   * @returns An object describing the position of the window, in CSS pixels,
   * relative to the top-left corner of the primary monitor. If a secondary
   * monitor exists above or to the left of the primary monitor, these values
   * will be negative.
   */
  getWindowPosition(windowHandle?: string) {
    return this._callSessionMethod<{ x: number; y: number }>(
      'getWindowPosition',
      windowHandle
    );
  }

  /**
   * Maximises a window according to the platform’s window system behaviour.
   *
   * @param windowHandle The name of the window to resize. See
   * [[Command.Command.switchToWindow] to learn about valid window names.
   * Omit this argument to resize the currently focused window.
   */
  maximizeWindow(windowHandle?: string) {
    return this._callSessionMethod<void>('maximizeWindow', windowHandle);
  }

  /**
   * Gets all cookies set on the current page.
   */
  getCookies() {
    return this._callSessionMethod<WebDriverCookie[]>('getCookies');
  }

  /**
   * Sets a cookie on the current page.
   */
  setCookie(cookie: WebDriverCookie) {
    return this._callSessionMethod<void>('setCookie', cookie);
  }

  /**
   * Clears all cookies for the current page.
   */
  clearCookies() {
    return this._callSessionMethod<void>('clearCookies');
  }

  /**
   * Deletes a cookie on the current page.
   *
   * @param name The name of the cookie to delete.
   */
  deleteCookie(name: string) {
    return this._callSessionMethod<void>('deleteCookie', name);
  }

  /**
   * Gets the HTML loaded in the focused window/frame. This markup is
   * serialised by the remote environment so may not exactly match the HTML
   * provided by the Web server.
   */
  getPageSource() {
    return this._callSessionMethod<string>('getPageSource');
  }

  /**
   * Gets the title of the top-level browsing context of the current window
   * or tab.
   */
  getPageTitle() {
    return this._callSessionMethod<string>('getPageTitle');
  }

  /**
   * Gets the currently focused element from the focused window/frame.
   */
  getActiveElement() {
    return this._callSessionMethod<Element>('getActiveElement');
  }

  /**
   * Types into the focused window/frame/element.
   *
   * @param keys The text to type in the remote environment. It is possible
   * to type keys that do not have normal character representations (modifier
   * keys, function keys, etc.) as well as keys that have two different
   * representations on a typical US-ASCII keyboard (numpad keys); use the
   * values from [[keys]] to type these special characters. Any modifier keys
   * that are activated by this call will persist until they are deactivated.
   * To deactivate a modifier key, type the same modifier key a second time,
   * or send `\uE000` ('NULL') to deactivate all currently active modifier
   * keys.
   */
  pressKeys(keys: string | string[]) {
    return this._callSessionMethod<void>('pressKeys', keys);
  }

  /**
   * Gets the current screen orientation.
   */
  getOrientation() {
    return this._callSessionMethod<'portrait' | 'landscape'>('getOrientation');
  }

  /**
   * Sets the screen orientation.
   *
   * @param orientation Either 'portrait' or 'landscape'.
   */
  setOrientation(orientation: 'portrait' | 'landscape') {
    return this._callSessionMethod<void>('setOrientation', orientation);
  }

  /**
   * Gets the text displayed in the currently active alert pop-up.
   */
  getAlertText() {
    return this._callSessionMethod<string>('getAlertText');
  }

  /**
   * Types into the currently active prompt pop-up.
   *
   * @param text The text to type into the pop-up’s input box.
   */
  typeInPrompt(text: string | string[]) {
    return this._callSessionMethod<void>('typeInPrompt', text);
  }

  /**
   * Accepts an alert, prompt, or confirmation pop-up. Equivalent to clicking
   * the 'OK' button.
   */
  acceptAlert() {
    return this._callSessionMethod<void>('acceptAlert');
  }

  /**
   * Dismisses an alert, prompt, or confirmation pop-up. Equivalent to
   * clicking the 'OK' button of an alert pop-up or the 'Cancel' button of a
   * prompt or confirmation pop-up.
   */
  dismissAlert() {
    return this._callSessionMethod<void>('dismissAlert');
  }

  /**
   * Moves the remote environment’s mouse cursor to the specified element or
   * relative position. If the element is outside of the viewport, the remote
   * driver will attempt to scroll it into view automatically.
   *
   * @param element The element to move the mouse to. If x-offset and
   * y-offset are not specified, the mouse will be moved to the centre of the
   * element.
   *
   * @param xOffset The x-offset of the cursor, maybe in CSS pixels, relative
   * to the left edge of the specified element’s bounding client rectangle.
   * If no element is specified, the offset is relative to the previous
   * position of the mouse, or to the left edge of the page’s root element if
   * the mouse was never moved before.
   *
   * @param yOffset The y-offset of the cursor, maybe in CSS pixels, relative
   * to the top edge of the specified element’s bounding client rectangle. If
   * no element is specified, the offset is relative to the previous position
   * of the mouse, or to the top edge of the page’s root element if the mouse
   * was never moved before.
   */
  moveMouseTo(
    element?: Element,
    xOffset?: number,
    yOffset?: number
  ): Command<void, P, StringResult>;
  moveMouseTo(
    xOffset?: number,
    yOffset?: number
  ): Command<void, P, StringResult>;
  moveMouseTo(...args: any[]) {
    return this._callSessionMethod<void>('moveMouseTo', ...args);
  }

  /**
   * Clicks a mouse button at the point where the mouse cursor is currently
   * positioned. This method may fail to execute with an error if the mouse
   * has not been moved anywhere since the page was loaded.
   *
   * @param button The button to click. 0 corresponds to the primary mouse
   * button, 1 to the middle mouse button, 2 to the secondary mouse button.
   * Numbers above 2 correspond to any additional buttons a mouse might
   * provide.
   */
  clickMouseButton(button?: number) {
    return this._callSessionMethod<void>('clickMouseButton', button);
  }

  /**
   * Depresses a mouse button without releasing it.
   *
   * @param button The button to press. See [[Command.Command.click]] for
   * available options.
   */
  pressMouseButton(button?: number) {
    return this._callSessionMethod<void>('pressMouseButton', button);
  }

  /**
   * Releases a previously depressed mouse button.
   *
   * @param button The button to press. See [[Command.Command.click]] for
   * available options.
   */
  releaseMouseButton(button?: number) {
    return this._callSessionMethod<void>('releaseMouseButton', button);
  }

  /**
   * Double-clicks the primary mouse button.
   */
  doubleClick() {
    return this._callSessionMethod<void>('doubleClick');
  }

  /**
   * Taps an element on a touch screen device. If the element is outside of
   * the viewport, the remote driver will attempt to scroll it into view
   * automatically.
   *
   * @param element The element to tap.
   */
  tap(element: Element) {
    return this._callSessionMethod<void>('tap', element);
  }

  /**
   * Depresses a new finger at the given point on a touch screen device
   * without releasing it.
   *
   * @param x The screen x-coordinate to press, maybe in device pixels.
   * @param y The screen y-coordinate to press, maybe in device pixels.
   */
  pressFinger(x: number, y: number) {
    return this._callSessionMethod<void>('pressFinger', x, y);
  }

  /**
   * Releases whatever finger exists at the given point on a touch screen
   * device.
   *
   * @param x The screen x-coordinate where a finger is pressed, maybe in
   * device pixels.
   * @param y The screen y-coordinate where a finger is pressed, maybe in
   * device pixels.
   */
  releaseFinger(x: number, y: number) {
    return this._callSessionMethod<void>('releaseFinger', x, y);
  }

  /**
   * Moves the last depressed finger to a new point on the touch screen.
   *
   * @param x The screen x-coordinate to move to, maybe in device pixels.
   * @param y The screen y-coordinate to move to, maybe in device pixels.
   */
  moveFinger(x: number, y: number) {
    return this._callSessionMethod<void>('moveFinger', x, y);
  }

  /**
   * Scrolls the currently focused window on a touch screen device.
   *
   * @param element An element to scroll to. The window will be scrolled so
   * the element is as close to the top-left corner of the window as
   * possible.
   *
   * @param xOffset An optional x-offset, relative to the left edge of the
   * element, in CSS pixels. If no element is specified, the offset is
   * relative to the previous scroll position of the window.
   *
   * @param yOffset An optional y-offset, relative to the top edge of the
   * element, in CSS pixels. If no element is specified, the offset is
   * relative to the previous scroll position of the window.
   */
  touchScroll(xOffset: number, yOffset: number): Command<void, P, StringResult>;
  touchScroll(
    element?: Element,
    xOffset?: number,
    yOffset?: number
  ): Command<void, P, StringResult>;
  touchScroll(...args: any[]) {
    return this._callSessionMethod<void>('touchScroll', ...args);
  }

  /**
   * Performs a double-tap gesture on an element.
   *
   * @method
   * @param element The element to double-tap.
   */
  doubleTap(element?: Element) {
    return this._callSessionMethod<void>('doubleTap', element);
  }

  /**
   * Performs a long-tap gesture on an element.
   *
   * @method
   * @param element The element to long-tap.
   */
  longTap(element?: Element) {
    return this._callSessionMethod<void>('longTap', element);
  }

  /**
   * Flicks a finger. Note that this method is currently badly specified and
   * highly dysfunctional and is only provided for the sake of completeness.
   *
   * @param element The element where the flick should start.
   * @param xOffset The x-offset in pixels to flick by.
   * @param yOffset The x-offset in pixels to flick by.
   * @param speed The speed of the flick, in pixels per *second*. Most human
   * flicks are 100–200ms, so this value will be higher than expected.
   */
  flickFinger(
    element: Element,
    xOffset: number,
    yOffset: number,
    speed?: number
  ): Command<void, P, StringResult>;
  flickFinger(
    xOffset: number,
    yOffset: number,
    speed?: number
  ): Command<void, P, StringResult>;
  flickFinger(...args: any[]) {
    return this._callSessionMethod<void>('flickFinger', ...args);
  }

  /**
   * Gets the current geographical location of the remote environment.
   *
   * @returns a [[interfaces.Geolocation]] value with latitude and longitude
   * specified using standard WGS84 decimal latitude/longitude. Altitude is
   * specified as meters above the WGS84 ellipsoid. Not all environments
   * support altitude.
   */
  getGeolocation() {
    return this._callSessionMethod<Geolocation>('getGeolocation');
  }

  /**
   * Sets the geographical location of the remote environment.
   *
   * @param location Latitude and longitude are specified using standard
   * WGS84 decimal latitude/longitude. Altitude is specified as meters above
   * the WGS84 ellipsoid. Not all environments support altitude.
   */
  setGeolocation(location: Geolocation) {
    return this._callSessionMethod<void>('setGeolocation', location);
  }

  /**
   * Gets all logs from the remote environment of the given type. The logs in
   * the remote environment are cleared once they have been retrieved.
   *
   * @param type The type of log entries to retrieve. Available log types
   * differ between remote environments. Use
   * [[Command.Command.getAvailableLogTypes]] to learn what log types are
   * currently available. Not all environments support all possible log
   * types.
   *
   * @returns An array of log entry objects. Timestamps in log entries are
   * Unix timestamps, in seconds.
   */
  getLogsFor(type: string) {
    return this._callSessionMethod<LogEntry[]>('getLogsFor', type);
  }

  /**
   * Gets the types of logs that are currently available for retrieval from
   * the remote environment.
   */
  getAvailableLogTypes() {
    return this._callSessionMethod<string[]>('getAvailableLogTypes');
  }

  /**
   * Gets the current state of the HTML5 application cache for the current
   * page.
   *
   * @returns The cache status. One of 0 (uncached), 1 (cached/idle), 2
   * (checking), 3 (downloading), 4 (update ready), 5 (obsolete).
   */
  getApplicationCacheStatus() {
    return this._callSessionMethod<number>('getApplicationCacheStatus');
  }

  /**
   * Terminates the session. No more commands will be accepted by the remote
   * after this point.
   */
  quit() {
    return this._callSessionMethod<void>('quit');
  }

  /**
   * Waits for all elements findable in the currently active window/frame
   * using the given strategy and value to be destroyed.
   *
   * @param using The element retrieval strategy to use. See
   * [[Command.Command.find]] for options.
   *
   * @param value The strategy-specific value to search for. See
   * [[Command.Command.find]] for details.
   */
  waitForDeleted(using: Strategy, value: string) {
    return this._callSessionMethod<void>('waitForDeleted', using, value);
  }

  /**
   * Gets the timeout for [[Command.Command.executeAsync]] calls.
   */
  getExecuteAsyncTimeout() {
    return this._callSessionMethod<number>('getExecuteAsyncTimeout');
  }

  /**
   * Sets the timeout for [[Command.Command.executeAsync]] calls.
   *
   * @param ms The length of the timeout, in milliseconds.
   */
  setExecuteAsyncTimeout(ms: number) {
    return this._callSessionMethod<void>('setExecuteAsyncTimeout', ms);
  }

  /**
   * Gets the timeout for [[Command.Command.find]] calls.
   */
  getFindTimeout() {
    return this._callSessionMethod<number>('getFindTimeout');
  }

  /**
   * Sets the timeout for [[Command.Command.find]] calls.
   *
   * @param ms The length of the timeout, in milliseconds.
   */
  setFindTimeout(ms: number) {
    return this._callSessionMethod<void>('setFindTimeout', ms);
  }

  /**
   * Gets the timeout for [[Command.Command.get]] calls.
   */
  getPageLoadTimeout() {
    return this._callSessionMethod<number>('getPageLoadTimeout');
  }

  /**
   * Sets the timeout for [[Command.Command.get]] calls.
   *
   * @param ms The length of the timeout, in milliseconds.
   */
  setPageLoadTimeout(ms: number) {
    return this._callSessionMethod<void>('setPageLoadTimeout', ms);
  }

  // Element methods

  /**
   * Clicks the element. This method works on both mouse and touch platforms.
   */
  click() {
    return this._callElementMethod<void>('click');
  }

  /**
   * Submits the element, if it is a form, or the form belonging to the
   * element, if it is a form element.
   */
  submit() {
    return this._callElementMethod<void>('submit');
  }

  /**
   * Gets the visible text within the element. `<br>` elements are converted
   * to line breaks in the returned text, and whitespace is normalised per
   * the usual XML/HTML whitespace normalisation rules.
   */
  getVisibleText() {
    return this._callElementMethod<StringResult>('getVisibleText');
  }

  /**
   * Types into the element. This method works the same as the
   * [[Command.Command.pressKeys]] method except that any modifier keys are
   * automatically released at the end of the command. This method should be
   * used instead of [[Command.Command.pressKeys]] to type filenames into
   * file upload fields.
   *
   * Since 1.5, if the WebDriver server supports remote file uploads, and you
   * type a path to a file on your local computer, that file will be
   * transparently uploaded to the remote server and the remote filename will
   * be typed instead. If you do not want to upload local files, use
   * [[Command.Command.pressKeys]] instead.
   *
   * @param value The text to type in the remote environment. See
   * [[Command.Command.pressKeys]] for more information.
   */
  type(value: string | string[]) {
    return this._callElementMethod<void>('type', value);
  }

  /**
   * Gets the tag name of the element. For HTML documents, the value is
   * always lowercase.
   */
  getTagName() {
    return this._callElementMethod<StringResult>('getTagName');
  }

  /**
   * Clears the value of a form element.
   */
  clearValue() {
    return this._callElementMethod<void>('clearValue');
  }

  /**
   * Returns whether or not a form element is currently selected (for
   * drop-down options and radio buttons), or whether or not the element is
   * currently checked (for checkboxes).
   */
  isSelected() {
    return this._callElementMethod<boolean>('isSelected');
  }

  /**
   * Returns whether or not a form element can be interacted with.
   */
  isEnabled() {
    return this._callElementMethod<boolean>('isEnabled');
  }

  /**
   * Gets a property or attribute of the element according to the WebDriver
   * specification algorithm. Use of this method is not recommended; instead,
   * use [[Command.Command.getAttribute]] to retrieve DOM attributes and
   * [[Command.Command.getProperty]] to retrieve DOM properties.
   *
   * This method uses the following algorithm on the server to determine what
   * value to return:
   *
   * 1. If `name` is 'style', returns the `style.cssText` property of the
   *    element.
   * 2. If the attribute exists and is a boolean attribute, returns 'true' if
   *    the attribute is true, or null otherwise.
   * 3. If the element is an `<option>` element and `name` is 'value',
   *    returns the `value` attribute if it exists, otherwise returns the
   *    visible text content of the option.
   * 4. If the element is a checkbox or radio button and `name` is
   *    'selected', returns 'true' if the element is checked, or null
   *    otherwise.
   * 5. If the returned value is expected to be a URL (e.g. element is `<a>`
   *    and attribute is `href`), returns the fully resolved URL from the
   *    `href`/`src` property of the element, not the attribute.
   * 6. If `name` is 'class', returns the `className` property of the
   *    element.
   * 7. If `name` is 'readonly', returns 'true' if the `readOnly` property is
   *    true, or null otherwise.
   * 8. If `name` corresponds to a property of the element, and the property
   *    is not an Object, return the property value coerced to a string.
   * 9. If `name` corresponds to an attribute of the element, return the
   *    attribute value.
   *
   * @param name The property or attribute name.
   * @returns The value of the attribute as a string, or `null` if no such
   * property or attribute exists.
   */
  getSpecAttribute(name: string) {
    return this._callElementMethod<StringResult>('getSpecAttribute', name);
  }

  /**
   * Gets an attribute of the element.
   *
   * See [[Element.Element.getProperty]] to retrieve an element property.
   *
   * @param name The name of the attribute.
   * @returns The value of the attribute, or `null` if no such attribute
   * exists.
   */
  getAttribute<S = StringResult>(name: string) {
    return this._callElementMethod<S>('getAttribute', name);
  }

  /**
   * Gets a property of the element.
   *
   * See [[Element.Element.getAttribute]] to retrieve an element attribute.
   *
   * @param name The name of the property.
   * @returns The value of the property.
   */
  getProperty<T = any>(name: string) {
    return this._callElementMethod<T>('getProperty', name);
  }

  /**
   * Determines if this element is equal to another element.
   */
  equals(other: Element) {
    return this._callElementMethod<boolean>('equals', other);
  }

  /**
   * Returns whether or not the element would be visible to an actual user.
   * This means that the following types of elements are considered to be not
   * displayed:
   *
   * 1. Elements with `display: none`
   * 2. Elements with `visibility: hidden`
   * 3. Elements positioned outside of the viewport that cannot be scrolled
   *    into view
   * 4. Elements with `opacity: 0`
   * 5. Elements with no `offsetWidth` or `offsetHeight`
   */
  isDisplayed() {
    return this._callElementMethod<boolean>('isDisplayed');
  }

  /**
   * Gets the position of the element relative to the top-left corner of the
   * document, taking into account scrolling and CSS transformations (if they
   * are supported).
   */
  getPosition() {
    return this._callElementMethod<{ x: number; y: number }>('getPosition');
  }

  /**
   * Gets the size of the element, taking into account CSS transformations
   * (if they are supported).
   */
  getSize() {
    return this._callElementMethod<{ width: number; height: number }>(
      'getSize'
    );
  }

  /**
   * Gets a CSS computed property value for the element.
   *
   * @param propertyName The CSS property to retrieve. This argument must be
   * hyphenated, *not* camel-case.
   */
  getComputedStyle(propertyName: string) {
    return this._callElementMethod<StringResult>(
      'getComputedStyle',
      propertyName
    );
  }
}

/**
 * The method passed to Command `then` callbacks that can be used to manually
 * set the Command chain context
 */
export interface SetContextMethod {
  (context: Element | Element[]): void;
}

/**
 * The current Context of a Command
 */
export interface Context extends Array<any> {
  isSingle?: boolean;
  depth?: number;
}

const TOP_CONTEXT: Context = [];
TOP_CONTEXT.isSingle = true;
TOP_CONTEXT.depth = 0;

let chaiAsPromised: any = null;
try {
  chaiAsPromised = require('chai-as-promised');
} catch (error) {}

// TODO: Add unit test
if (chaiAsPromised) {
  (<any>chaiAsPromised).transferPromiseness = function(
    assertion: any,
    promise: any
  ) {
    assertion.then = promise.then.bind(promise);
    for (let method in promise) {
      if (typeof promise[method] === 'function') {
        assertion[method] = promise[method].bind(promise);
      }
    }
  };
}

// Return the 'parent' of a value, which is assumed to be a Command or Session
function getParent<S extends string | string[]>(
  value: any
): Command<any, any, S> | Session | undefined {
  return value && value.parent;
}

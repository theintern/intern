import { global } from '../../../common';

import { Events, Executor, NoDataEvents, Handle } from '../executors/Executor';
import { ErrorFormatOptions } from '../common/ErrorFormatter';

/**
 * This is a base class for reporters that provides convenienience features such
 * as event handler registration and a default console.
 */
export default class Reporter implements ReporterProperties {
  readonly executor: Executor;

  protected _console: Console | undefined;
  protected _executor: Executor | undefined;
  protected _handles: Handle[] | undefined;
  protected _output: ReporterOutput | undefined;

  /**
   * A mapping from event names to the names of methods on this object. This
   * property should be defined on the class prototype. It is automatically
   * created by the @eventHandler decorator.
   */
  protected _eventHandlers: { [eventName: string]: string } | undefined;

  constructor(executor: Executor, options: ReporterOptions = {}) {
    if (options.output) {
      this.output = options.output;
    }
    if (options.console) {
      this.console = options.console;
    }
    this.executor = executor;
    this._registerEventHandlers();
  }

  get console() {
    if (!this._console) {
      this._console = getConsole();
    }
    return this._console;
  }

  set console(value: Console) {
    this._console = value;
  }

  get output() {
    if (!this._output) {
      // Use process.stdout in a Node.js environment, otherwise construct
      // a writable-like object that outputs to the console.
      if (global.process != null) {
        return global.process.stdout;
      } else {
        const _console = this.console;
        this._output = {
          write(chunk: string, _encoding: string, callback: Function) {
            _console.log(chunk);
            callback();
          },
          end(chunk: string, _encoding: string, callback: Function) {
            _console.log(chunk);
            callback();
          }
        };
      }
    }
    return this._output;
  }

  set output(value: ReporterOutput) {
    this._output = value;
  }

  formatError(error: Error, options?: ErrorFormatOptions) {
    return this.executor.formatError(error, options);
  }

  /**
   * Register any handlers added to the class event handlers map
   */
  protected _registerEventHandlers() {
    if (!this._eventHandlers) {
      return;
    }

    // Use a for..in loop because _eventHandlers may inherit from a parent
    for (let name in this._eventHandlers) {
      this.executor.on(<keyof Events>name, (...args: any[]) => {
        const handler = this._eventHandlers![name];
        return (<any>this)[handler](...args);
      });
    }
  }
}

/**
 * Create a decorator that will add a decorated method to a class's list of
 * event handlers.
 */
export function createEventHandler<
  E extends Events,
  N extends NoDataEvents = NoDataEvents
>() {
  return function() {
    function decorate(
      target: any,
      propertyKey: N,
      _descriptor: TypedPropertyDescriptor<() => void | Promise<any>>
    ): void;
    function decorate<T extends keyof E>(
      target: any,
      propertyKey: T,
      _descriptor: TypedPropertyDescriptor<(data: E[T]) => void | Promise<any>>
    ): void;
    function decorate<T extends keyof E>(
      target: any,
      propertyKey: T,
      _descriptor:
        | TypedPropertyDescriptor<(data: E[T]) => void | Promise<any>>
        | TypedPropertyDescriptor<() => void | Promise<any>>
    ) {
      if (!target.hasOwnProperty('_eventHandlers')) {
        if (target._eventHandlers != null) {
          // If there's an _eventHandlers property on a parent,
          // inherit from it
          target._eventHandlers = Object.create(target._eventHandlers);
        } else {
          target._eventHandlers = {};
        }
      }
      target._eventHandlers[propertyKey] = propertyKey;
    }
    return decorate;
  };
}

/**
 * The default event handler decorator.
 */
export const eventHandler = createEventHandler();

export interface ReporterProperties {
  output: ReporterOutput;
  console: Console;
}

export type ReporterOptions = Partial<ReporterProperties>;

/**
 * A stream that reporters can write to
 */
export interface ReporterOutput {
  write(chunk: string | Buffer, encoding?: string, callback?: Function): void;
  end(chunk: string | Buffer, encoding?: string, callback?: Function): void;
}

function getConsole() {
  if (typeof console !== 'undefined') {
    return console;
  }

  return <Console>{
    assert: noop,
    count: noop,
    dir: noop,
    error: noop,
    exception: noop,
    info: noop,
    log: noop,
    table: noop,
    time: noop,
    timeEnd: noop,
    trace: noop,
    warn: noop
  };
}

function noop() {
  // do nothing
}

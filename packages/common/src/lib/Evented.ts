import { Handle, createCompositeHandle } from './util';

/**
 * Map of computed regular expressions, keyed by string
 */
const regexMap = new Map<string, RegExp>();

/**
 * An event emitter
 */
export default class Evented<
  M extends CustomEventTypes = {},
  T = EventType,
  O extends EventObject<T> = EventObject<T>
> {
  // The following member is purely so TypeScript remembers the type of `M`
  // when extending so that the utilities in `on.ts` will work
  // https://github.com/Microsoft/TypeScript/issues/20348
  // tslint:disable-next-line
  protected __typeMap__?: M;
  /**
   * map of listeners keyed by event type
   */
  protected listenersMap: Map<T | keyof M, EventedCallback<T, O>[]> = new Map();

  /** register handles for the instance */
  private handles: Handle[];

  constructor() {
    this.handles = [];
  }

  /**
   * Emits the event object for the specified type
   *
   * @param event the event to emit
   */
  emit<K extends keyof M>(event: M[K]): void;
  emit(event: O): void;
  emit(event: any): void {
    this.listenersMap.forEach((methods, type) => {
      if (isGlobMatch(type as any, event.type)) {
        [...methods].forEach(method => {
          method.call(this, event);
        });
      }
    });
  }

  /**
   * Catch all handler for various call signatures. The signatures are defined in
   * `BaseEventedEvents`.  You can add your own event type -> handler types by extending
   * `BaseEventedEvents`.  See example for details.
   *
   * @param args
   *
   * ```ts
   * interface WidgetBaseEvents extends BaseEventedEvents {
   *     (type: 'properties:changed', handler: PropertiesChangedHandler): Handle;
   * }
   * class WidgetBase extends Evented {
   *    on: WidgetBaseEvents;
   * }
   * ```
   */
  on<K extends keyof M>(
    type: K,
    listener: EventedCallbackOrArray<K, M[K]>
  ): Handle;
  on(type: T, listener: EventedCallbackOrArray<T, O>): Handle;
  on(type: any, listener: EventedCallbackOrArray<any, any>): Handle {
    if (Array.isArray(listener)) {
      const handles = listener.map(listener =>
        this._addListener(type, listener)
      );
      return {
        destroy() {
          handles.forEach(handle => handle.destroy());
        }
      };
    }
    return this._addListener(type, listener);
  }

  /**
   * Register handles for the instance that will be destroyed when
   * `this.destroy` is called
   *
   * Returns a handle for the handle, removes the handle for the instance and
   * calls destroy
   *
   * @param handle The handle to add for the instance
   */
  own(handles: Handle | Handle[]): Handle {
    const handle = Array.isArray(handles)
      ? createCompositeHandle(...handles)
      : handles;
    const { handles: _handles } = this;
    _handles.push(handle);
    return {
      destroy() {
        _handles.splice(_handles.indexOf(handle));
        handle.destroy();
      }
    };
  }

  /**
   * Destrpys all handers registered for the instance
   *
   * Returns a promise that resolves once all handles have been destroyed
   */
  destroy() {
    return new Promise<boolean>(resolve => {
      this.handles.forEach(handle => {
        handle && handle.destroy && handle.destroy();
      });
      this.destroy = noop;
      this.own = destroyed;
      resolve(true);
    });
  }
  private _addListener(type: T | keyof M, listener: EventedCallback<T, O>) {
    const listeners = this.listenersMap.get(type) || [];
    listeners.push(listener);
    this.listenersMap.set(type, listeners);
    return {
      destroy: () => {
        const listeners = this.listenersMap.get(type) || [];
        listeners.splice(listeners.indexOf(listener), 1);
      }
    };
  }
}

export type EventedCallback<
  T = EventType,
  E extends EventObject<T> = EventObject<T>
> = {
  /**
   * A callback that takes an `event` argument
   *
   * @param event The event object
   */
  (event: E): boolean | void;
};

export interface CustomEventTypes<
  T extends EventObject<any> = EventObject<any>
> {
  [index: string]: T;
}

/**
 * A type which is either a targeted event listener or an array of listeners
 * @template T The type of target for the events
 * @template E The event type for the events
 */
export type EventedCallbackOrArray<
  T = EventType,
  E extends EventObject<T> = EventObject<T>
> = EventedCallback<T, E> | EventedCallback<T, E>[];

export type EventType = string | symbol;

/**
 * The base event object, which provides a `type` property
 */
export interface EventObject<T = EventType> {
  /** The type of the event */
  readonly type: T;
}

/**
 * No op function used to replace own, once instance has been destoryed
 */
function destroyed(_handles: Handle | Handle[]): Handle {
  throw new Error('Call made to destroyed method');
}

/**
 * Determines is the event type glob has been matched
 *
 * Returns a boolean that indicates if the glob is matched
 */
function isGlobMatch(
  globString: string | symbol,
  targetString: string | symbol
): boolean {
  if (
    typeof targetString === 'string' &&
    typeof globString === 'string' &&
    globString.indexOf('*') !== -1
  ) {
    let regex: RegExp;
    if (regexMap.has(globString)) {
      regex = regexMap.get(globString)!;
    } else {
      regex = new RegExp(`^${globString.replace(/\*/g, '.*')}$`);
      regexMap.set(globString, regex);
    }
    return regex.test(targetString);
  } else {
    return globString === targetString;
  }
}

/**
 * No operation function to replace own once instance is destoryed
 */
function noop() {
  return Promise.resolve(false);
}

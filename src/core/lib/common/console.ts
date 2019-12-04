import { global } from '../../../common';

export function log(...args: any[]) {
  if (global.console && global.console.log) {
    try {
      global.console.log.apply(global.console, args);
    } catch (error) {}
  }
}

export function error(...args: any[]) {
  if (global.console && global.console.error) {
    try {
      global.console.error.apply(global.console, args);
    } catch (error) {}
  }
}

export function warn(...args: any[]) {
  if (global.console && global.console.warn) {
    try {
      global.console.warn.apply(global.console, args);
    } catch (error) {}
  }
}

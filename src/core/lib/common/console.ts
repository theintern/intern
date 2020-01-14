import { global } from '../../../common';

export function log(...args: any[]) {
  if (global.console && global.console.log) {
    try {
      global.console.log(...args);
    } catch {
      // ignore
    }
  }
}

export function error(...args: any[]) {
  if (global.console && global.console.error) {
    try {
      global.console.error(...args);
    } catch {
      // ignore
    }
  }
}

export function warn(...args: any[]) {
  if (global.console && global.console.warn) {
    try {
      global.console.warn(...args);
    } catch {
      // ignore
    }
  }
}

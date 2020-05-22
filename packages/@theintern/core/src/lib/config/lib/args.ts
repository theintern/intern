import { Args, ArgType } from './types';

/**
 * Parse an array of name=value arguments into an object
 */
export function parseArgs(rawArgs: string[]): Args {
  const parsedArgs: Args = {};

  for (const arg of rawArgs) {
    let name = arg;
    let value: string | undefined;
    let args = parsedArgs;

    const eq = arg.indexOf('=');
    if (eq !== -1) {
      name = arg.slice(0, eq);
      value = arg.slice(eq + 1);
    }

    if (name.indexOf('.') !== -1) {
      const parts = name.split('.');
      const head = parts.slice(0, parts.length - 1);
      name = parts[parts.length - 1];

      for (const part of head) {
        const k = part as keyof Args;
        if (!args[k]) {
          args[k] = {};
        }
        args = args[k] as { [name: string]: ArgType };
      }
    }

    const propName = name as keyof Args;

    if (typeof value === 'undefined') {
      args[propName] = true;
    } else {
      if (!(name in args)) {
        args[propName] = value;
      } else if (!Array.isArray(args[propName])) {
        args[propName] = [args[propName], value] as any;
      } else {
        (args[propName] as ArgType[]).push(value);
      }
    }
  }

  return parsedArgs;
}

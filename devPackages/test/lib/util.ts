import { sep } from 'path';

export function pathRe(regex: string, flags?: string): RegExp {
  if (sep !== '/') {
    const winRegEx = regex.replace(/\//g, '\\\\');
    return new RegExp(winRegEx, flags);
  }
  return new RegExp(regex, flags);
}

/**
 * Parse a JSON string that may contain comments
 */
export function parseJson(json: string) {
  return JSON.parse(removeComments(json));
}

/**
 * Remove JS-style line and block comments from a string
 */
export function removeComments(text: string) {
  let state: 'string' | 'block-comment' | 'line-comment' | 'default' =
    'default';
  let i = 0;

  // Create an array of chars from the text, the blank out anything in a
  // comment
  const chars = text.split('');

  while (i < chars.length) {
    switch (state) {
      case 'block-comment':
        if (chars[i] === '*' && chars[i + 1] === '/') {
          chars[i] = ' ';
          chars[i + 1] = ' ';
          state = 'default';
          i += 2;
        } else if (chars[i] !== '\n') {
          chars[i] = ' ';
          i += 1;
        } else {
          i += 1;
        }
        break;

      case 'line-comment':
        if (chars[i] === '\n') {
          state = 'default';
        } else {
          chars[i] = ' ';
        }
        i += 1;
        break;

      case 'string':
        if (chars[i] === '"') {
          state = 'default';
          i += 1;
        } else if (chars[i] === '\\' && chars[i + 1] === '\\') {
          i += 2;
        } else if (chars[i] === '\\' && chars[i + 1] === '"') {
          i += 2;
        } else {
          i += 1;
        }
        break;

      default:
        if (chars[i] === '"') {
          state = 'string';
          i += 1;
        } else if (chars[i] === '/' && chars[i + 1] === '*') {
          chars[i] = ' ';
          chars[i + 1] = ' ';
          state = 'block-comment';
          i += 2;
        } else if (chars[i] === '/' && chars[i + 1] === '/') {
          chars[i] = ' ';
          chars[i + 1] = ' ';
          state = 'line-comment';
          i += 2;
        } else {
          i += 1;
        }
    }
  }

  return chars.join('');
}

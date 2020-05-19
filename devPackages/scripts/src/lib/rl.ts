import readline from 'readline';

let rl: readline.Interface;

export async function ask(
  question: string,
  isValid = defaultValidator
): Promise<string> {
  for (;;) {
    const asker = new Promise<string>(resolve => {
      rl.question(question, resolve);
    });
    const answer = await asker;
    if (isValid(answer)) {
      return answer;
    }
    print("Input isn't in the expected format. Try again.");
  }
}

export function defaultValidator(value: string): boolean {
  return Boolean(value);
}

export function init() {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  process.on('exit', () => {
    rl.close();
  });
}

export function isVersion(value: string): boolean {
  return /^\d+(\.\d+)+$/.test(value);
}

export function isYesNo(value: string): boolean {
  return /^(y|n)$/i.test(value);
}

export function print(message?: string) {
  console.log(message || '');
}

export function stop() {
  rl.close();
}

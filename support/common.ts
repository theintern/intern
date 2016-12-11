import { readFileSync } from 'fs';
import { echo, exec as shellExec, ExecOptions, ExecOutputReturnValue } from 'shelljs';

interface ExecReturnValue extends ExecOutputReturnValue {
	stdout: string;
	stderr: string;
};

const tsconfig = JSON.parse(readFileSync('tsconfig.json', { encoding: 'utf8' }));
const buildDir = tsconfig.compilerOptions.outDir;
export { buildDir, tsconfig };

export function exec(command: string, options?: ExecOptions) {
	if (!options) {
		options = {};
	}
	if (options.silent == null) {
		options.silent = true;
	}
	const result = <ExecReturnValue> shellExec(command, options);
	if (result.code) {
		echo(`Error (${result.code})`);
		echo(result.stderr);
		process.exit(result.code);
	}
	return result;
}

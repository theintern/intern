import * as program from 'commander';
import { wrap } from './util';

export default program;

const { Command } = program;
const sep = '  ';

Command.prototype.missingArgument = function(name: string) {
	console.error(`Error: missing required argument '${name}'`);
	process.exit(1);
};

Command.prototype.optionMissingArgument = function(option: program.IOption) {
	console.error(`Error: option '${option.flags}' requires an argument`);
	process.exit(1);
};

Command.prototype.unknownOption = function(flag: string) {
	console.error(`Error: unknown option '${flag}'`);
	process.exit(1);
};

Command.prototype.variadicArgNotLast = function(name: string) {
	console.error(`Error: variadic arguments must be last (${name}}`);
	process.exit(1);
};

Command.prototype.optionHelp = function(this: InternalCommand) {
	const width = this.largestOptionLength();
	const wrapper = (line: string) =>
		wrap(line, { indent: width + sep.length });

	return this.options
		.map(
			option =>
				`${pad(option.flags, width)}${sep}${wrapper(
					option.description
				)}`
		)
		.concat([
			`${pad('-h, --help', width)}  ${wrapper(
				'output usage information'
			)}`
		])
		.join('\n');
};

Command.prototype.commandHelp = function(this: InternalCommand) {
	if (!this.commands.length) {
		return '';
	}

	const commands = this.commands.filter(cmd => !cmd._noHelp).map(cmd => {
		const args = cmd._args
			.map(function(arg) {
				return humanReadableArgName(arg);
			})
			.join(' ');

		return [
			`${cmd._name}${cmd._alias ? `|${cmd._alias}` : ''}${cmd.options
				.length
				? ' [options]'
				: ''} ${args}`,
			cmd._description
		];
	});

	const cmdWidth = commands.reduce(
		(max, command) => Math.max(max, command[0].length),
		0
	);

	const wrapper = (str: string) =>
		wrap(str, { indent: cmdWidth + sep.length });

	return [
		'Commands:',
		'',
		commands
			.map(cmd => {
				const desc = wrapper(cmd[1]);
				return `${pad(cmd[0], cmdWidth)}${desc ? `${sep}${desc}` : ''}`;
			})
			.join('\n')
			.replace(/^/gm, sep),
		''
	].join('\n');
};

Command.prototype.helpInformation = function(this: InternalCommand) {
	const desc: string[] = [];
	if (this._description) {
		desc.push(wrap(this._description), '');
	}

	let cmdName = this._name;
	if (this._alias) {
		cmdName = `${cmdName}|${this._alias}`;
	}
	const usage = ['', `Usage: ${cmdName} ${this.usage()}`, ''];

	const cmds: string[] = [];
	let commandHelp = this.commandHelp();
	if (commandHelp) {
		cmds.push(commandHelp);
	}

	let options = ['Options:', '', this.optionHelp().replace(/^/gm, sep), ''];

	return [...usage, ...desc, ...options, ...cmds].join('\n');
};

interface ArgDetails {
	required: boolean;
	name: string;
	variadic: boolean;
}

interface InternalCommand extends program.ICommand {
	_alias: string;
	_args: ArgDetails[];
	_description: string;
	_name: string;
	_noHelp: boolean;
	commands: InternalCommand[];
	options: program.IOption[];
}

function humanReadableArgName(arg: ArgDetails) {
	const nameOutput = `${arg.name}${arg.variadic === true ? '...' : ''}`;
	return arg.required ? `<${nameOutput}>` : `[${nameOutput}]`;
}

function pad(str: string, width: number) {
	const len = Math.max(0, width - str.length);
	return str + Array(len + 1).join(' ');
}

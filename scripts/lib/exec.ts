import execa, { ExecaChildProcess, Options } from 'execa';

const procs: ExecaChildProcess[] = [];

// If the parent process is interrupted, clean up any child processes
process.on('SIGINT', () => {
  for (const proc of procs) {
    proc.cancel();
  }
});

/**
 * Execute a process
 */
export default function exec(
  cmd: string,
  args?: string[],
  options?: Options
): ExecaChildProcess {
  const proc = execa(cmd, args, options);
  procs.push(proc);
  return proc;
}

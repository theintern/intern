import { rm } from 'shelljs';
import { Tunnel } from '@theintern/digdug';
import { sep } from 'path';

/**
 * Cleans up a tunnel by stopping it if the tunnel is running and deleting its target install directory
 */
export function cleanup(tunnel: Tunnel) {
  if (!tunnel) {
    return Promise.resolve();
  }

  let error: Error | undefined;

  return tunnel
    .stop()
    .catch((err) => {
      error = err;
    })
    .then(() => {
      deleteTunnelFiles(tunnel);
      if (error) {
        throw error;
      }
    });
}

/**
 * Deletes a tunnel's target install directory
 */
export function deleteTunnelFiles(tunnel: Tunnel) {
  const args = getDigdugArgs();
  if (!tunnel || !tunnel.directory || args.noClean) {
    return;
  }

  rm('-rf', tunnel.directory);
}

/**
 * Return command line args specific to digdug
 */
export function getDigdugArgs() {
  return {
    noClean: (<any>intern.config).noClean,
  };
}

export function pathRe(regex: string, flags?: string): RegExp {
  if (sep !== '/') {
    const winRegEx = regex.replace(/\//g, '\\\\');
    return new RegExp(winRegEx, flags);
  }
  return new RegExp(regex, flags);
}

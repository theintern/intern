import { rm } from 'shelljs';
import Tunnel from '../../src/Tunnel';

/**
 * Cleans up a tunnel by stopping it if the tunnel is running and deleting its target install directory
 *
 * @param tunnel
 * @return {Promise} A promise that resolves when cleanup is complete
 */
export function cleanup(tunnel: Tunnel) {
  if (!tunnel) {
    return Promise.resolve();
  }

  let error: Error | undefined;

  return tunnel
    .stop()
    .catch(err => {
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
    noClean: (<any>intern.config).noClean
  };
}

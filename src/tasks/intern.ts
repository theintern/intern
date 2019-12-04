import { global } from '../common';
import Node from '../core/lib/executors/Node';
import { Config } from '../core/lib/common/config';
import { getConfig } from '../core/lib/node/util';

export = function(grunt: IGrunt) {
  grunt.registerMultiTask('intern', function() {
    const done = this.async();
    const options = this.options<TaskOptions>({});

    // Force colored output for istanbul report
    process.env.FORCE_COLOR = 'true';

    getConfigAndOptions(options)
      .then(({ config, options }) => {
        const intern = (global.intern = new Node());
        intern.configure(config);
        intern.configure(options);

        return intern.run();
      })
      .then(finish, finish);

    function finish(error?: any) {
      global.intern = null;
      done(error);
    }
  });
};

interface TaskOptions extends grunt.task.ITaskOptions, Partial<Config> {
  [key: string]: any;
}

function getConfigAndOptions(
  options: TaskOptions
): Promise<{
  config: Partial<Config>;
  options: TaskOptions;
}> {
  if (options.config) {
    return getConfig(options.config, []).then(({ config }) => {
      const opts = { ...options };
      delete opts.config;
      return { config, options: opts };
    });
  }

  return Promise.resolve({ config: {}, options });
}

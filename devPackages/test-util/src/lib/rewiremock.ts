import rewiremock, { plugins } from 'rewiremock';

// Manually setup rewiremock instead of loading rewiremock/node or
// rewiremock/webpack (which are the same). This is done to override the
// filenameTransformer used in Node to handle non-sibling modules.
rewiremock.addPlugin({
  ...plugins.nodejs,
  fileNameTransformer(fileName: string, module: NodeJS.Module) {
    try {
      return plugins.nodejs.filenameTransformer(fileName, module);
    } catch {
      return require.resolve(`${fileName}`, { paths: [process.cwd()] });
    }
  }
});

export default rewiremock;

import { makeExtension } from '@riboseinc/paneron-extension-kit';

export default makeExtension({
  mainView: () => import('./RepoView'),
  name: "Aperis site",
  requiredHostAppVersion: "^1.0.0-alpha19",
  datasetMigrations: {},
  datasetInitializer: () => import('./migrations/initial'),
});

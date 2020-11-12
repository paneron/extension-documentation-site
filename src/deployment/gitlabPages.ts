import getAperisSetupChangeset from './aperisBase';
import { DeploymentSetup } from './types';


const setup: DeploymentSetup = {
  title: "GitLab Pages",
  description: "Basic configuration for a GitLab pages setup.",
  getChangeset: (settings, remove = false) => {
    return {

      ...getAperisSetupChangeset(settings, remove),

      '.gitlab-ci.yml': {
        encoding: 'utf-8',
        oldValue: undefined,
        newValue: remove ? null : `
image: "node:14"
pages:
  cache:
    paths: [node_modules]
  artifacts:
    paths: [dist]
  only: [master]
  script:
    - yarn install
    - yarn build
        `
      },
    };
  },
}


export default setup;

import getAperisSetupChangeset from './aperisBase';
import { DeploymentSetup } from './types';


const setup: DeploymentSetup = {
  title: "GitLab Pages",
  description: "Basic configuration for a GitLab pages setup. NOTE: If your GitLab repository is at “https://gitlab.com/youraccount/your-project”, and you do not configure a custom domain name in Pages setup, then you also need to set site prefix to “your-project” (without quotes) in site settings. Your site will be available at “youraccount.gitlab.ci/your-project”.",
  getChangeset: (settings, remove = false) => {
    const reactStaticOut = 'dist';
    const gitlabPublic = 'public';
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
    paths: [public]
  only: [master]
  script:
    - yarn
    - yarn build
    - rm -rf ${gitlabPublic}
    - cp -R ${reactStaticOut} ${gitlabPublic}
        `
      },
    };
  },
}


export default setup;

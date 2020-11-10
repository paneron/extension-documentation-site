import getAperisSetupChangeset from './aperisBase';
import { DeploymentSetup } from './types';


const setup: DeploymentSetup = {
  title: "AWS S3 + CF; GHA",
  description: "Configures a GitHub Actions workflow that deploys site to AWS S3 and CloudFront. (Note: this will not create AWS resources for you. You are expected to specify relevant variables in repository settings.)",
  getChangeset: (settings, remove = false) => {
    return {

      ...getAperisSetupChangeset(settings, remove),

      '.github/workflows/deploy-master.yml': {
        encoding: 'utf-8',
        oldValue: undefined,
        newValue: remove ? null : `
  name: deploy-master

  on:
    schedule:
      - cron: '42 */12 * * *'
    push:
      branches: [ master ]
    repository_dispatch:
      types: [ deploy_master ]

  jobs:
    build:
      name: Build site
      runs-on: ubuntu-latest
      steps:
        - name: Use Node
          uses: actions/setup-node@v1
          with:
            node-version: '14.x'
        - uses: actions/checkout@master
        - name: Install NPM dependencies
          run: |
            yarn install
        - name: Build site
          run: |
            yarn build

        - name: Deploy to AWS
          env:
            AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
            AWS_REGION: \${{ secrets.AWS_REGION }}
            AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
            CLOUDFRONT_DISTRIBUTION_ID: \${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}
            S3_BUCKET_NAME: \${{ secrets.S3_BUCKET_NAME }}
          run: |
            aws s3 sync dist s3://$S3_BUCKET_NAME --region=$AWS_REGION --delete --no-progress --exclude "*" --include "*.html" --content-type "text/html; charset=utf-8"
            aws s3 sync dist s3://$S3_BUCKET_NAME --region=$AWS_REGION --delete --no-progress --exclude "*" --include "*.json" --content-type "application/json; charset=utf-8"
            aws s3 sync dist s3://$S3_BUCKET_NAME --region=$AWS_REGION --delete --no-progress --exclude "*" --include "*.jsonld" --content-type "application/ld+json; charset=utf-8"
            aws s3 sync dist s3://$S3_BUCKET_NAME --region=$AWS_REGION --delete --no-progress --exclude "*" --include "*.ttl" --content-type "text/turtle; charset=utf-8"
            aws s3 sync dist s3://$S3_BUCKET_NAME --region=$AWS_REGION --delete --no-progress --include "*" --exclude "*.html" --exclude "*.json" --exclude "*.jsonld" --exclude "*.ttl"
            aws configure set preview.cloudfront true
            aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths "/*"
        `
      },
    };
  },
}


export default setup;

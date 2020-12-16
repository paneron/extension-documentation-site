import yaml from 'js-yaml';
import { DatasetMigrationFunction } from '@riboseinc/paneron-extension-kit/types/migrations';
import { SourceDocPageData } from '../types';


export const FIRST_PAGE_STUB: SourceDocPageData = {
  title: "Home",
  redirectFrom: [],
  media: [],
};


const initializeDataset: DatasetMigrationFunction = async (opts) => {
  opts?.onProgress?.("Creating top-level page…");
  return {
    versionAfter: '1.0.0-alpha33',
    changeset: {
      'docs/index.yaml': {
        encoding: 'utf-8' as const,
        oldValue: null,
        newValue: yaml.dump(FIRST_PAGE_STUB, { noRefs: true }),
      },
    },
  };
};

export default initializeDataset;

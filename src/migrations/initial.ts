import path from 'path';
import { DatasetMigrationFunction } from '@riboseinc/paneron-extension-kit/types/migrations';
import { yamlFile } from '@riboseinc/paneron-extension-kit/object-specs/ser-des';
import { SourceDocPageData } from '../types';


export const FIRST_PAGE_STUB: SourceDocPageData = {
  title: "Home",
  redirectFrom: [],
  media: [],
};


const sep = path.posix.sep;


const initializeDataset: DatasetMigrationFunction = async (opts) => {
  opts?.onProgress?.("Creating top-level page…");
  return {
    versionAfter: '1.0.0-alpha33',
    bufferChangeset: {
      '/docs/index.yaml': {
        oldValue: null,
        newValue: yamlFile.serialize(FIRST_PAGE_STUB, {})[sep],
      },
    },
  };
};

export default initializeDataset;

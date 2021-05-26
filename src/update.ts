import log from 'electron-log';
import yaml from 'js-yaml';
import path from 'path';

import { ObjectChange, ObjectChangeset } from '@riboseinc/paneron-extension-kit/types/objects';

import { SourceDocPageData } from './types';
import { DocPageMediaHook } from './hooks';
import { filepathCandidates } from './util';
import { BufferDataset } from '@riboseinc/paneron-extension-kit/types/buffers';


export function getAddMediaChangeset(
  targetDir: string,
  bufferDataset: BufferDataset,
): ObjectChangeset {
  let changeset: ObjectChangeset = {};

  for (const [objectPath, objectData] of Object.entries(bufferDataset)) {
    if (objectData === null) {
      continue;
    }

    const relativeMediaFilename = path.basename(objectPath);
    const targetPath = path.posix.join(targetDir, relativeMediaFilename);

    changeset[targetPath] = {
      oldValue: null,
      newValue: objectData.toString(),
    } as ObjectChange;
  }
  return changeset;
}


/* Can be used to move files corresponding to given media items to another directory,
   or to delete them (e.g., if the page is getting deleted). */
export function getUpdateMediaChangeset(
  media: SourceDocPageData["media"],
  mediaData: ReturnType<DocPageMediaHook>["value"],
  sourceDir: string,
  targetDir: string | null,
): ObjectChangeset {
  let changeset: ObjectChangeset = {};

  log.info("Update media changeset", arguments);
  if (sourceDir === null) {
    log.error("Update media: Missing source dir", media);
    throw new Error("Missing source directory");
  }
  if (sourceDir === targetDir) {
    log.warn("Update media: Source and target dirs are the same");
    return {};
  }
  if (sourceDir.startsWith('/') || targetDir?.startsWith('/')) {
    log.warn("Leading slashes when getting update media changeset");
  }
  //log.debug("Getting update media changeset", media, mediaData, sourceDir, targetDir);

  for (const relativeMediaFilename of media) {
    const fileData = mediaData.data[path.posix.join(sourceDir, relativeMediaFilename)];

    if (fileData === null) {
      log.error("Updating media: Cannot find media data", fileData);
      throw new Error("Cannot find media data to move");
    }

    if (targetDir !== null) {
      changeset[path.posix.join(targetDir, relativeMediaFilename)] = {
        oldValue: null,
        newValue: { binaryData: fileData.value },
      };
    }

    changeset[path.posix.join(sourceDir, relativeMediaFilename)] = {
      oldValue: { binaryData: fileData.value },
      newValue: null,
    };

  }
  return changeset;
}


export function getMovePathChangeset(
  filePaths: { pathInUse: string, nestedPath: string, flatPath: string },
  pageData: SourceDocPageData,
  hasChildren: boolean,
  mediaData: ReturnType<DocPageMediaHook>["value"],
  newPath: string,
): ObjectChangeset {

  const newAsNested = filepathCandidates(newPath)[0];

  if (hasChildren) {
    log.error("Can’t move page because it contains children");
    throw new Error("Can’t move a page that contains children");
  }

  const fromDir = path.dirname(filePaths.pathInUse);
  const toDir = path.dirname(newAsNested);

  return {
    [filePaths.pathInUse]: {
      oldValue: undefined,
      newValue: null,
    },
    [newAsNested]: {
      oldValue: null,
      newValue: pageData,
    },
    ...getUpdateMediaChangeset(pageData.media, mediaData, fromDir, toDir),
  };
}


export function getAddPageChangeset(
  newPageFilePath: string,
  newPageData: SourceDocPageData,
  parentFilePaths: { pathInUse: string, nestedPath: string, flatPath: string },
  parentPageData: SourceDocPageData,
  parentPageMediaData: ReturnType<DocPageMediaHook>["value"],
): ObjectChangeset {
  const parentDataYAML = yaml.dump(parentPageData, { noRefs: true });

  let mediaChangeset: ObjectChangeset;

  if (parentFilePaths.pathInUse === parentFilePaths.flatPath) {
    mediaChangeset = getUpdateMediaChangeset(
      parentPageData.media,
      parentPageMediaData,
      path.dirname(parentFilePaths.flatPath),
      path.dirname(parentFilePaths.nestedPath));

  } else {
    mediaChangeset = {};
  }

  return {
    [newPageFilePath]: {
      oldValue: null,
      newValue: newPageData,
    },
    [parentFilePaths.nestedPath]: {
      oldValue: undefined,
      newValue: parentDataYAML,
    },
    [parentFilePaths.flatPath]: {
      oldValue: undefined,
      newValue: null,
    },
    ...mediaChangeset,
  };
}


export function getDeletePageChangeset(
  filePaths: { pathInUse: string, nestedPath: string, flatPath: string },
  pageData: SourceDocPageData,
  mediaData: ReturnType<DocPageMediaHook>["value"],
  hasChildren: boolean,
): ObjectChangeset {
  const { pathInUse } = filePaths;

  if (hasChildren) {
    log.error("Won’t delete documentation page because it has children", filePaths.pathInUse);
    throw new Error("Won’t delete documentation page because it has children");
  }

  return {
    [pathInUse]: {
      oldValue: undefined,
      newValue: null,
    },
    ...getUpdateMediaChangeset(pageData.media, mediaData, path.dirname(pathInUse), null),
  };
}


export function getUpdatePageChangeset(
  filePaths: { pathInUse: string, nestedPath: string, flatPath: string },
  hasChildren: boolean,
  newPageData: SourceDocPageData,
): ObjectChangeset {
  const { pathInUse, flatPath } = filePaths;

  if (hasChildren && pathInUse === flatPath) {
    // Should not happen
    log.error("Malformed page: uses flat path, but has children");
    throw new Error("Page file is malformed");
  }

  return {
    [pathInUse]: {
      oldValue: undefined,
      newValue: newPageData,
    },
  };
}

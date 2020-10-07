import log from 'electron-log';
import yaml from 'js-yaml';
import path from 'path';

import {
  FileChangeType,
  ObjectChangeset,
} from '@riboseinc/paneron-extension-kit/types';

import { filepathCandidates } from './util';
import { SourceDocPageData } from './types';
import { DocPageDataHook, DocPageSyncStatusHook } from './hooks';


export function getPageChangeset(
  syncStatus: ReturnType<DocPageSyncStatusHook>,
  pageData: ReturnType<DocPageDataHook>,
  docPath: string,
  oldPage: SourceDocPageData | null,
  newPage: SourceDocPageData | null,
): [changeset: ObjectChangeset, verb: string] {
  if (oldPage !== null) {
    let filePath: string | undefined = undefined;

    log.debug("Page is being updated", docPath);

    const children = Object.keys(pageData).find(path => path.startsWith(`${docPath}/`)) || [];
    log.debug("Page children", children);

    const pathCandidates = filepathCandidates(docPath);
    log.debug("File path candidates", pathCandidates);

    const _pathCandidateSyncStatus: [(FileChangeType | undefined), (FileChangeType | undefined)] =
      pathCandidates.map(p => syncStatus.asFiles[`/${p}`]) as [(FileChangeType | undefined), (FileChangeType | undefined)];

    if (_pathCandidateSyncStatus.filter(p => p !== undefined).length !== 1) {
      log.error("Could not find existing doc page path", docPath, _pathCandidateSyncStatus, syncStatus.asFiles);
      throw new Error("Could not find existing doc page path");
    }

    const pathCandidateSyncStatus = {
      nested: { path: pathCandidates[0], status: _pathCandidateSyncStatus[0] },
      flat: { path: pathCandidates[1], status: _pathCandidateSyncStatus[1] },
    };

    log.debug("File path candidate sync status", pathCandidateSyncStatus);

    if (children.length > 0 && newPage !== null) {
      filePath = pathCandidates[0];
    } else {
      filePath = pathCandidateSyncStatus.flat.status !== undefined
        ? pathCandidateSyncStatus.flat.path
        : pathCandidateSyncStatus.nested.path;
    }

    // Double-check
    if (syncStatus.asFiles[`/${filePath}`] === undefined) {
      log.error("Could not confirm existing doc page path", docPath, syncStatus);
      throw new Error("Could not confirm existing doc page path");
    }

    if (newPage === null) {
      if (children.length > 0) {
        log.error("Won’t delete documentation page because it has children", docPath, children);
        throw new Error("Won’t delete documentation page because it has children");
      }

      return [{
        [filePath]: {
          encoding: 'utf-8',
          oldValue: undefined,
          newValue: null,
        },
      }, "Delete"];

    } else {
      if (children.length > 0 && pathCandidateSyncStatus.flat.status === undefined) {
        log.warn("Will move page");

        log.warn("Need to move media");
        // TODO: moveMedia()

        return [{
          [pathCandidateSyncStatus.flat.path]: {
            encoding: 'utf-8',
            oldValue: undefined,
            newValue: null,
          },
          [filePath]: {
            encoding: 'utf-8',
            oldValue: null,
            newValue: yaml.dump(newPage, { noRefs: true }),
          },
        }, "Update"];

      } else {
        return [{
          [filePath]: {
            encoding: 'utf-8',
            oldValue: undefined,
            newValue: yaml.dump(newPage, { noRefs: true }),
          },
        }, "Update"];
      }
    }

  } else if (newPage !== null) {
    log.debug("Page is being created", docPath);

    const parent = path.dirname(docPath);
    const parentData = pageData.value[parent];

    if (parentData === undefined) {
      log.error("Cannot add child page: Unable to get parent page data", docPath, parent, parentData);
      throw new Error("Cannot add child page: Unable to get parent page data");
    }

    const parentDataYAML = yaml.dump(parentData, { noRefs: true });

    log.warn("Parent page media may need to be moved");
    // TODO: moveMedia()

    return [{
      [filepathCandidates(docPath)[1]]: {
        encoding: 'utf-8',
        oldValue: null,
        newValue: yaml.dump(newPage, { noRefs: true }),
      },
      [filepathCandidates(parent)[0]]: {
        encoding: 'utf-8',
        oldValue: undefined,
        newValue: parentDataYAML,
      },
      [filepathCandidates(parent)[1]]: {
        encoding: 'utf-8',
        oldValue: undefined,
        newValue: null,
      },
    }, "Create"];

  } else {
    log.error("Unknown action: not saving, creating or deleting a page", docPath, oldPage, newPage);
    throw new Error("Unknown action");
  }
}

import path from 'path';
import yaml from 'js-yaml';

import {
  FileChangeType,
  ObjectDataHook,
  ObjectDataRequest, ObjectSyncStatusHook,
  ValueHook,
} from '@riboseinc/paneron-extension-kit/types';

import { SourceDocPageData } from './types';
import { filepathCandidates, filepathToDocsPath, getDocPagePaths, isDocumentationPage } from './util';



export type DocPageSyncStatusHook = (useObjectSyncStatus: ObjectSyncStatusHook) =>
  ReturnType<ObjectSyncStatusHook> & { asFiles: Record<string, FileChangeType> }

export type DocPageDataHook = (useObjectData: ObjectDataHook, paths: string[]) =>
  ValueHook<Record<string, SourceDocPageData>>;

export type DocPageMediaHook = (useObjectData: ObjectDataHook, pagePath: string, allFiles: string[]) =>
  ReturnType<ObjectDataHook>;


export const useDocPageSyncStatus: DocPageSyncStatusHook = (useObjectSyncStatus) => {
  const result = useObjectSyncStatus();
  const objects = result.value;

  const filteredObjects = Object.entries(objects).
    filter(([atPath, _]) => isDocumentationPage(atPath)).
    map(([path, changeStatus]) => ({
      [filepathToDocsPath(path)]: changeStatus,
    })).
    reduce((p, c) => ({ ...p, ...c }), {});

  return {
    ...result,
    value: filteredObjects,
    asFiles: objects,
  };
};


export const useDocPageData: DocPageDataHook = (useObjectData, paths) => {
  const dataRequest: ObjectDataRequest = paths.map(path => {
    //return { [path]: 'utf-8' as const };
    const possiblePaths = filepathCandidates(path);
    let request: ObjectDataRequest = {};
    for (const path of possiblePaths) {
      request[path] = 'utf-8' as const;
    }
    return request;
  }).reduce((p, c) => ({ ...p, ...c }), {});

  const data = useObjectData(dataRequest);

  const parsedData = Object.entries(data.value).
  filter(([ _, data ]) => data !== null && data.encoding === 'utf-8').
  map(([ path, data ]) => {
    const item: SourceDocPageData = yaml.load(data!.value as string);
    if (item.media === undefined) {
      item.media = [];
    }
    return { [filepathToDocsPath(path)]: item };
  }).
  reduce((p, c) => ({ ...p, ...c }), {});

  return {
    ...data,
    value: parsedData
  };
};


export const useDocPageMedia: DocPageMediaHook = (useObjectData, docPath, allFiles) => {
  const page = useDocPageData(useObjectData, [docPath]).value[docPath] || null;

  const mediaData = useObjectData(
    (page?.media || []).
    map(mediaFile => {
      const dir = getDocPagePaths(docPath, allFiles);
      if (mediaFile.endsWith('.svg')) {
        return { [path.join(dir.pathInUse, mediaFile)]: 'utf-8' as const } as ObjectDataRequest;
      } else {
        return { [path.join(dir.pathInUse, mediaFile)]: undefined } as ObjectDataRequest;
      }
    }).
    reduce((p, c) => ({ ...p, ...c }), {}));

  return mediaData;
};

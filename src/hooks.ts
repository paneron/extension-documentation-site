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
import { FOOTER_BANNER_FILENAME, HEADER_BANNER_FILENAME, SETTINGS_FILENAME, SiteSettings } from './SiteSettings';



export type DocPageSyncStatusHook = (useObjectSyncStatus: ObjectSyncStatusHook) =>
  ReturnType<ObjectSyncStatusHook> & { asFiles: Record<string, FileChangeType> }

export type DocPageDataHook = (useObjectData: ObjectDataHook, paths: string[]) =>
  ValueHook<Record<string, SourceDocPageData>>;

export type DocPageMediaHook = (useObjectData: ObjectDataHook, pagePath: string, allFiles: string[]) =>
  ReturnType<ObjectDataHook>;

export type DocSiteSettingsHook = (useObjectData: ObjectDataHook) =>
  ValueHook<SiteSettings | null>


export const useDocPageSyncStatus: DocPageSyncStatusHook = (useObjectSyncStatus) => {
  const result = useObjectSyncStatus();
  const objects = result.value;

  const filteredFiles: Record<string, FileChangeType> = Object.entries(objects).
    filter(([atPath, _]) => isDocumentationPage(atPath)).
    map(([atPath, state]) => ({ [atPath]: state })).
    reduce((p, c) => ({ ...p, ...c }), {});

  const asDocPaths = Object.entries(filteredFiles).
    map(([path, changeStatus]) => ({
      [filepathToDocsPath(path)]: changeStatus,
    })).
    reduce((p, c) => ({ ...p, ...c }), {});

  return {
    ...result,
    value: asDocPaths,
    asFiles: filteredFiles,
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
  const page: SourceDocPageData | null = useDocPageData(useObjectData, [docPath]).value[docPath] || null;

  let dir: string | undefined;
  try {
    dir = path.dirname(getDocPagePaths(docPath, allFiles).pathInUse);
  } catch (e) {
    dir = undefined;
  }

  let request: ObjectDataRequest;

  if (page !== null && dir !== undefined) {
    request = (page.media || []).
      map(mediaFile => {
        if (!dir) { return {}; }
        const filePath = path.posix.join(dir, mediaFile);
        if (mediaFile.endsWith('.svg')) {
          return { [filePath]: 'utf-8' as const } as ObjectDataRequest;
        } else {
          return { [filePath]: 'binary' as const } as ObjectDataRequest;
        }
      }).
      reduce((p, c) => ({ ...p, ...c }), {});
  } else {
    request = {};
  }

  //log.debug("Media data request", page?.media, dir, allFiles, request);

  return useObjectData(request);
};


export const useSiteSettings: DocSiteSettingsHook = (useObjectData) => {
  const settingsHook = useObjectData({
    [SETTINGS_FILENAME]: 'utf-8',
    [HEADER_BANNER_FILENAME]: 'utf-8',
    [FOOTER_BANNER_FILENAME]: 'utf-8',
  });

  const hasSettingFiles: boolean = [SETTINGS_FILENAME, HEADER_BANNER_FILENAME, FOOTER_BANNER_FILENAME].
  find(fn => settingsHook.value[fn] === undefined || settingsHook.value[fn] === null) === undefined;

  if (!hasSettingFiles) {
    return { ...settingsHook, value: null  };
  }

  const settingsFileData = yaml.load(settingsHook.value[SETTINGS_FILENAME]!.value as string);

  const settingsFormatIsCorrect: boolean = (
    (settingsFileData.title || '') !== '' &&
    settingsFileData.urlPrefix !== undefined &&
    (settingsFileData.footerBannerLink || '') !== '');

  if (!settingsFormatIsCorrect) {
    return { ...settingsHook, value: null  };
  }

  const originalSettings: SiteSettings = {
    title: settingsFileData.title,
    urlPrefix: settingsFileData.urlPrefix,
    footerBannerLink: settingsFileData.footerBannerLink,

    headerBannerBlob: settingsHook.value[HEADER_BANNER_FILENAME]!.value as string,
    footerBannerBlob: settingsHook.value[FOOTER_BANNER_FILENAME]!.value as string,
  };

  return { ...settingsHook, value: originalSettings };
}

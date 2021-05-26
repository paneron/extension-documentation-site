import path from 'path';
import yaml from 'js-yaml';

import log from 'electron-log';

import { Hooks, ValueHook } from '@riboseinc/paneron-extension-kit/types';

import { SourceDocPageData } from './types';
import { filepathCandidates, objectPathToDocsPath } from './util';
import { FOOTER_BANNER_FILENAME, HEADER_BANNER_FILENAME, SETTINGS_FILENAME, SiteSettings } from './SiteSettings';



export type DocPageDataHook = (useObjectData: Hooks.Data.GetObjectDataset, paths: string[]) =>
  ValueHook<Record<string, SourceDocPageData>>;

export type DocPageMediaHook = (useObjectData: Hooks.Data.GetObjectDataset, media: string[], pageFilePath: string | undefined) =>
  ReturnType<Hooks.Data.GetObjectDataset>;

export type DocSiteSettingsHook = (useObjectData: Hooks.Data.GetObjectDataset) =>
  ValueHook<SiteSettings | null>


export const useDocPageData: DocPageDataHook = (useObjectData, paths) => {
  const objectPaths: string[] = paths.map(p => {
    return filepathCandidates(p) as string[];
  }).reduce((p, c) => ([ ...p, ...c ]), []);

  const data = useObjectData({ objectPaths });

  const parsedData = Object.entries(data.value.data).
  filter(([ _, data ]) => data !== null).
  map(([ path, data ]) => {
    const item: SourceDocPageData = data! as SourceDocPageData;
    if (item.media === undefined) {
      item.media = [];
    }
    return { [objectPathToDocsPath(path)]: item };
  }).
  reduce((p, c) => ({ ...p, ...c }), {});

  return {
    ...data,
    value: parsedData
  };
};


export const useDocPageMedia: DocPageMediaHook = (useObjectData, media, pageObjectPath) => {
  let objectPaths: string[];

  if (!pageObjectPath) {
    log.warn("Cannot load page media data: missing page file path");
    objectPaths = [];

  } else if (media.length > 0) {
    const dir = path.dirname(pageObjectPath);

    if (!dir) {
      objectPaths = [];
    }

    objectPaths = (media).
      map(mediaFile => {
        return path.posix.join(dir, mediaFile);
      });

  } else {
    objectPaths = [];
  }

  log.debug("Media data request", media, pageObjectPath, objectPaths);

  return useObjectData({ objectPaths });
};


export const useSiteSettings: DocSiteSettingsHook = (useObjectData) => {
  const settingsHook = useObjectData({
    objectPaths: [SETTINGS_FILENAME, HEADER_BANNER_FILENAME, FOOTER_BANNER_FILENAME],
  });

  const hasSettingFiles: boolean = [SETTINGS_FILENAME, HEADER_BANNER_FILENAME, FOOTER_BANNER_FILENAME].
  find(fname => settingsHook.value.data[fname] === undefined || settingsHook.value.data[fname] === null) === undefined;

  if (!hasSettingFiles) {
    return { ...settingsHook, value: null  };
  }

  const settingsFileData = yaml.load(settingsHook.value.data[SETTINGS_FILENAME]!.value as string);

  const settingsFormatIsCorrect: boolean = (
    (settingsFileData.title || '') !== '' &&
    settingsFileData.docsURLPrefix !== undefined &&
    settingsFileData.siteURLPrefix !== undefined &&
    (settingsFileData.footerBannerLink || '') !== '');

  if (!settingsFormatIsCorrect) {
    return { ...settingsHook, value: null  };
  }

  const originalSettings: SiteSettings = {
    title: settingsFileData.title,
    docsURLPrefix: settingsFileData.docsURLPrefix,
    siteURLPrefix: settingsFileData.siteURLPrefix,
    footerBannerLink: settingsFileData.footerBannerLink,

    headerBannerBlob: settingsHook.value.data[HEADER_BANNER_FILENAME]!.value as string,
    footerBannerBlob: settingsHook.value.data[FOOTER_BANNER_FILENAME]!.value as string,
    deploymentSetup: settingsFileData.deploymentSetup || null,
  };

  return { ...settingsHook, value: originalSettings };
}

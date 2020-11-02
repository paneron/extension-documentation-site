/** @jsx jsx */
/** @jsxFrag React.Fragment */

import path from 'path';
import yaml from 'js-yaml';
import update from 'immutability-helper';
import log from 'electron-log';
import React, { useState } from 'react';
import { css, jsx } from '@emotion/core';

import {
  Button, ButtonGroup, Classes, Colors, Icon,
  ITreeNode, NonIdealState, Spinner, Tree,
} from '@blueprintjs/core';

import { FileChangeType, ObjectChangeset, RepositoryViewProps } from '@riboseinc/paneron-extension-kit/types';

import { SourceDocPageData } from './types';
import { useDocPageData, useDocPageMedia, useDocPageSyncStatus, useSiteSettings } from './hooks';
import { DocPageEdit } from './DocPageEdit';
import { getAddMediaChangeset, getAddPageChangeset, getDeletePageChangeset, getMovePathChangeset, getUpdateMediaChangeset, getUpdatePageChangeset } from './update';
import { filepathCandidates, getDocPagePaths } from './util';
import { SiteSettings } from './SiteSettings';


Object.assign(console, log);


const FIRST_PAGE_STUB: SourceDocPageData = {
  title: "Home",
  redirectFrom: [],
  media: [],
};


export const RepositoryView: React.FC<RepositoryViewProps> = ({ ...props }) => {
  return <AperisSite {...props} />;
}

const AperisSite: React.FC<RepositoryViewProps> =
function ({
    requestFileFromFilesystem, makeAbsolutePath,
    useObjectData, useObjectSyncStatus,
    changeObjects,
  }) {
  //log.debug("Rendering Doc site repository view");

  const [isBusy, setBusy] = useState(false);

  const settingsData = useSiteSettings(useObjectData);

  const urlPrefix = settingsData.value?.urlPrefix || '';

  const [selectedPagePath, selectPage] = useState<string>('docs');

  const syncStatus = useDocPageSyncStatus(useObjectSyncStatus);

  const allFiles = Object.keys(useObjectSyncStatus().value);

  //log.debug("Page sync status", syncStatus.value)

  const allPageData = useDocPageData(
    useObjectData,
    Object.keys(syncStatus.value));

  const selectedPageData: SourceDocPageData | null = allPageData.value[selectedPagePath] || null;

  let docPageFilePath: string | undefined;
  try {
    docPageFilePath = getDocPagePaths(selectedPagePath, allFiles).pathInUse;
  } catch (e) {
    docPageFilePath = undefined;
  }
  const selectedPageMediaData = useDocPageMedia(
    useObjectData,
    selectedPageData?.media || [],
    docPageFilePath);

  const selectedPageChildren = Object.keys(allPageData.value).
  filter(path => path.startsWith(`${selectedPagePath}/`)) || [];

  const selectedPageHasChildren = selectedPagePath
    ? selectedPageChildren.length > 0
    : false;

  function handleNodeClick(n: ITreeNode) {
    selectPage(n.id as string);
  }

  interface DocPageNodeData { importance?: number, filePath: string }

  const occupiedURLs: { [url: string]: string } = Object.entries(allPageData.value).
  map(([p, data]) => {
    let urlsOccupiedByThisPage: { [url: string]: string } = { [p]: data.title };
    for (const redirectedURL of (data.redirectFrom || [])) {
      urlsOccupiedByThisPage[redirectedURL] = data.title;
    }
    return urlsOccupiedByThisPage;
  }).reduce((p, c) => ({ ...p, ...c }), {});

  const nodes: ITreeNode<DocPageNodeData>[] = Object.entries(allPageData.value).
  sort(([path1, _1], [path2, _2]) => path1.localeCompare(path2)).
  map(([path, data]) => {
    const effectivePath = path.replace('/index.yaml', '').replace('.yaml', '');
    const isSelected = selectedPagePath === effectivePath;
    return {
      id: effectivePath,
      label: data.title,
      isSelected,
      hasCaret: false,
      isExpanded: true,
      secondaryLabel: <DocPageActions
        syncStatus={syncStatus.value[effectivePath]} />,
      data: { importance: data.importance, filePath: path },
    };
  });
  //log.debug("Nodes", nodes)

  const nodeTree: ITreeNode<DocPageNodeData> = nodes.reduce((prev, curr) => {
    const prevID = prev.id as string;
    const currID = curr.id as string;

    if (prevID === currID) {
      return curr;
    }

    const currPathParts = currID.split('/');

    function attachToParent(candidates: ITreeNode<DocPageNodeData>[]) {
      for (const candidate of candidates) {
        const candidateParts = (candidate.id as string).split('/');
        if (JSON.stringify(currPathParts.slice(0, -1)) === JSON.stringify(candidateParts)) {
          candidate.childNodes ||= [];
          candidate.childNodes!.push(curr);
        } else {
          attachToParent(candidate.childNodes || []);
        }
      }
    }
    attachToParent([prev]);
    return prev;

  }, {
    id: 'docs',
    label: "Docs",
    isExpanded: true,
    childNodes: [],
    data: { filePath: '/docs/index.yaml' },
  } as ITreeNode<DocPageNodeData>);
  //log.debug("Node hierarchy", nodeTree)

  async function handleApplyChangeset(changeset: ObjectChangeset, message: string) {
    log.debug("Applying changeset", changeset, message);
    if (isBusy) { return; }
    setBusy(true);
    try {
      log.silly("Applying changeset…");
      await changeObjects(changeset, message, true);
    } catch (e) {
      log.error("Got error while applying changeset", e, message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMedia(): Promise<string[]> {
    if (!selectedPageData) {
      throw new Error("Selected page data could not be found");
    }
    const filePaths = getDocPagePaths(selectedPagePath, allFiles);
    const selectedFiles = await requestFileFromFilesystem({
      prompt: "Choose images to add to this page’s media",
      allowMultiple: false,
      filters: [{ name: "PNG and JPEG images", extensions: ['png', 'jpeg', 'jpg'] }],
    });

    log.info("Got files", selectedFiles);

    const newPage = {
      ...selectedPageData,
      media: [
        ...(selectedPageData.media || []),
        ...Object.keys(selectedFiles),
      ],
    };
    const pageChangeset = getUpdatePageChangeset(
      filePaths,
      selectedPageHasChildren,
      newPage)

    const mediaChangeset = getAddMediaChangeset(
      path.dirname(filePaths.pathInUse),
      selectedFiles);

    const changeset = {
      ...pageChangeset,
      ...mediaChangeset,
    };

    await handleApplyChangeset(changeset, `Add media to ${selectedPagePath}`);

    return Object.keys(selectedFiles);
  }

  async function handleDeleteMedia(idx: number) {
    if (!selectedPageData) {
      throw new Error("Selected page data could not be found");
    }

    const mediaFilename = (selectedPageData.media || [])[idx];

    if (mediaFilename === undefined) {
      log.error("Deleting media: no media at given position", idx);
      throw new Error("Cannot delete media: item at given position does not exist");
    }

    const filePaths = getDocPagePaths(selectedPagePath, allFiles);
    const mediaPath = path.posix.join(path.dirname(filePaths.pathInUse), mediaFilename);
    const mediaData = selectedPageMediaData.value[mediaPath.replace(/^\//, '')];

    if (mediaData === null || mediaData === undefined) {
      log.error("Deleting media: cannot read data for media at given position",
        idx, mediaPath, selectedPageMediaData.value, mediaData);
      throw new Error("Cannot delete media: cannot read data for media at given position");
    }

    const newPage = update(selectedPageData, {
      media: {
        $set: update(selectedPageData!.media, { $splice: [[idx, 1]] }),
      },
    })

    const pageChangeset = getUpdatePageChangeset(
      filePaths,
      selectedPageHasChildren,
      newPage,
    );

    const mediaChangeset = getUpdateMediaChangeset(
      [mediaFilename],
      { [mediaPath]: mediaData },
      path.dirname(filePaths.pathInUse),
      null);

    const changeset = {
      ...pageChangeset,
      ...mediaChangeset,
    };

    return await handleApplyChangeset(changeset, `Delete media #${idx} from ${selectedPagePath}`);
  }

  function handleSavePage(
      docPath: string,
      oldPage: SourceDocPageData | null,
      newPage: SourceDocPageData | null) {

    log.debug("Updating doc page", docPath, oldPage, newPage);

    let changeset: ObjectChangeset;
    let verb: string;

    if (oldPage !== null && newPage !== null) {
      const filePaths = getDocPagePaths(docPath, allFiles);
      verb = "Update";
      changeset = getUpdatePageChangeset(
        filePaths,
        selectedPageHasChildren,
        newPage)

    } else if (oldPage !== null) {
      const filePaths = getDocPagePaths(docPath, allFiles);
      if (!selectedPageData || docPath !== selectedPagePath || yaml.dump(oldPage) !== yaml.dump(selectedPageData)) {
        throw new Error("Cannot delete a page that is not selected");
      }
      verb = "Delete";
      log.debug("Selected page media", selectedPageMediaData.value);
      log.debug("Selected page has children", selectedPageHasChildren);
      changeset = getDeletePageChangeset(
        filePaths,
        selectedPageData,
        selectedPageMediaData.value,
        selectedPageHasChildren)

    } else if (newPage !== null) {
      verb = "Create";
      const parentDocPath = path.dirname(docPath);
      if (parentDocPath !== selectedPagePath) {
        throw new Error("Mismatching parent page paths");
      }
      const parentData = allPageData.value[selectedPagePath];
      if (!parentData) {
        throw new Error("Unable to get parent page data when creating a page");
      }
      changeset = getAddPageChangeset(
        filepathCandidates(docPath)[0],
        newPage,
        getDocPagePaths(selectedPagePath, Object.keys(syncStatus.asFiles)),
        parentData,
        selectedPageMediaData.value);

    } else {
      throw new Error("Invalid action when saving page");
    }

    return handleApplyChangeset(changeset, `${verb} ${docPath}`).then(() => {
      if (newPage === null) {
        selectPage(path.dirname(docPath));
      } else {
        selectPage(docPath);
      }
    });
  }

  async function handleChangePath(oldPath: string, newPath: string, leaveRedirect: boolean) {
    log.debug("Moving doc page", oldPath, newPath, selectedPageMediaData.value);

    if (oldPath !== selectedPagePath || !selectedPageData) {
      log.error("Won’t move page: selected page path does not match given");
      throw new Error("Moving page that is not selected")
    }

    const pageData = { ...selectedPageData };

    if (leaveRedirect) {
      pageData.redirectFrom ||= [];
      pageData.redirectFrom.push(oldPath);
    }

    const changeset = await getMovePathChangeset(
      getDocPagePaths(oldPath, Object.keys(syncStatus.asFiles)),
      pageData,
      selectedPageHasChildren,
      selectedPageMediaData.value,
      newPath);

    await handleApplyChangeset(changeset, `Move ${oldPath} to ${newPath}`);

    selectPage(newPath);
  }

  if ((syncStatus.isUpdating || allPageData.isUpdating) && Object.keys(allPageData.value).length < 1) {
    return <NonIdealState icon={<Spinner />} description="Loading page data…" />;

  } else if (Object.keys(allPageData.value).length < 1) {
    return <NonIdealState
      icon="clean"
      title="There are no documentation pages yet."
      description={
        <Button disabled={isBusy} intent="success" large onClick={async () => {
          setBusy(true);
          try {
            await changeObjects({
              'docs/index.yaml': {
                encoding: 'utf-8' as const,
                oldValue: null,
                newValue: yaml.dump(FIRST_PAGE_STUB, { noRefs: true }),
              },
            }, "Create top-level page");
          } finally {
            setBusy(false);
          }
        }}>
          Create top-level page
        </Button>
      }
    />
  }

  let mediaDir: string | undefined
  try {
    mediaDir = makeAbsolutePath(path.dirname(getDocPagePaths(selectedPagePath, Object.keys(syncStatus.asFiles)).pathInUse));
  } catch (e) {
    log.error("Unable to get mediaDir", e);
    mediaDir = undefined;
  }

  return (
    <div css={css`flex: 1; display: flex; flex-flow: row nowrap; overflow: hidden;`}>
      <div css={css`width: 30vw; min-width: 350px; overflow: hidden; display: flex; flex-flow: column nowrap;`}>
        <div css={css`flex: 1; overflow-y: auto; background: ${Colors.WHITE};`}>
          <Tree
            contents={[nodeTree]}
            onNodeClick={!isBusy ? handleNodeClick : undefined} />
        </div>
        <div css={css`overflow-y: auto; padding: 1rem 1rem .5rem 1rem;`}>
          <SiteSettings
            changeObjects={changeObjects}
            originalSettings={settingsData}
            requestFileFromFilesystem={requestFileFromFilesystem}
          />
        </div>
      </div>
      {mediaDir !== undefined
        ? <div css={css`flex: 1; display: flex; flex-flow: column nowrap;`} className={Classes.ELEVATION_2}>
            <DocPageEdit
              key={`${selectedPagePath}-${(selectedPageData?.media || []).length}`}

              useDocPageData={useDocPageData}
              useObjectData={useObjectData}

              path={selectedPagePath}
              urlPrefix={urlPrefix}

              mediaDir={mediaDir}

              onSave={!isBusy ? handleSavePage : undefined}
              onAddMedia={!isBusy ? handleAddMedia : undefined}
              onDeleteMedia={(!isBusy && Object.keys(selectedPageMediaData.value).length > 0)
                ? handleDeleteMedia
                : undefined}
              onUpdatePath={(selectedPageHasChildren || isBusy) ? undefined : handleChangePath}
              onAddSubpage={!isBusy ? (async () => {
                const occupiedChildPaths = selectedPageChildren.map(c => path.basename(c));
                const newID: string = occupiedChildPaths.indexOf('new-page') >= 0
                  ? `new-page-${occupiedChildPaths.filter(p => p.startsWith('new-page')).length}`
                  : 'new-page';
                await handleSavePage!(`${selectedPagePath}/${newID}`, null, {
                  title: "New page",
                  media: [],
                  redirectFrom: [],
                });
              }) : undefined}
              onDelete={(selectedPageHasChildren || isBusy) ? undefined : async () => {
                await handleSavePage!(selectedPagePath, selectedPageData, null);
              }}

              getPageTitleAtPath={(path) => (occupiedURLs[path] || null)}
              mediaData={selectedPageMediaData}
            />
          </div>
        : <NonIdealState title="No page is selected" />}
    </div>
  );
};


const DocPageActions: React.FC<{
  syncStatus?: FileChangeType
}> =
function ({ syncStatus }) {

  return (
    <ButtonGroup minimal>
      <Icon
        title={syncStatus !== 'unchanged' && syncStatus !== undefined
          ? `This page has been ${syncStatus} since last synchronization`
          : undefined}
        icon={syncStatus === 'unchanged' ? 'tick-circle' : 'asterisk'}
      />
    </ButtonGroup>
  );
};

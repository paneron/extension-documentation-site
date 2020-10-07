/** @jsx jsx */
/** @jsxFrag React.Fragment */

import yaml from 'js-yaml';
import path from 'path';
import log from 'electron-log';
import React from 'react';
import { css, jsx } from '@emotion/core';

import { Button, ButtonGroup, Colors, ITreeNode, NonIdealState, Tree } from '@blueprintjs/core';

import { FileChangeType, ObjectChangeset, RepositoryViewProps } from '@riboseinc/paneron-extension-kit/types';

import { SourceDocPageData } from './types';
import { useDocPageData, useDocPageMedia, useDocPageSyncStatus } from './hooks';
import { DocPageEdit } from './DocPageEdit';
import { getAddPageChangeset, getDeletePageChangeset, getMovePathChangeset, getUpdatePageChangeset } from './update';
import { filepathCandidates, getDocPagePaths } from './util';


Object.assign(console, log);


export const RepositoryView: React.FC<RepositoryViewProps> =
function ({ React, useObjectData, useObjectSyncStatus, changeObjects }) {
  //log.debug("Rendering Doc site repository view");

  const [isBusy, setBusy] = React.useState(false);

  const [selectedPagePath, selectPage] = React.useState<string>('docs');

  const syncStatus = useDocPageSyncStatus(useObjectSyncStatus);

  //log.debug("Page sync status", syncStatus.value)

  const allPageData = useDocPageData(
    useObjectData,
    Object.keys(syncStatus.value).map(path => path.substring(1)));

  const selectedPageData: SourceDocPageData | null = allPageData.value[selectedPagePath] || null;

  const selectedPageMediaData = useDocPageMedia(
    useObjectData,
    selectedPagePath,
    Object.keys(syncStatus));

  const selectedPageHasChildren = selectedPagePath
    ? (Object.keys(allPageData.value).find(path => path.startsWith(`${selectedPagePath}/`)) || []).length > 0
    : false;

  //React.useEffect(() => {
  //  if (allPageData.value[selectedPagePath] === undefined) {
  //    selectPage('docs');
  //  }
  //}, [selectedPagePath, Object.keys(allPageData.value)]);

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
        docPath={effectivePath}
        childPages={[]}
        onSavePage={!isBusy && isSelected ? handleSavePage : undefined}
        syncStatus={syncStatus.value[`/${effectivePath}`]}
        pageData={allPageData.value[effectivePath]}
      />,
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
          candidate.secondaryLabel = <DocPageActions
            docPath={candidate.id as string}
            pageData={allPageData.value[candidate.id as string]}
            onSavePage={!isBusy && candidate.isSelected ? handleSavePage : undefined}
            syncStatus={syncStatus.value[`/${candidate.id as string}`]}
            childPages={candidate.childNodes} />;
        } else {
          attachToParent(candidate.childNodes || []);
        }
      }
    }
    attachToParent([prev]);
    return prev;

  }, { id: 'docs', label: "Docs", isExpanded: true, childNodes: [], data: { filePath: '/docs/index.yaml' } } as ITreeNode<DocPageNodeData>);
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

  function handleSavePage(
      docPath: string,
      oldPage: SourceDocPageData | null,
      newPage: SourceDocPageData | null) {

    log.debug("Updating doc page", docPath, oldPage, newPage);

    let changeset: ObjectChangeset;
    let verb: string;

    log.silly(1);

    const allFiles = Object.keys(syncStatus.asFiles);

    log.silly(2);

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
      log.silly(3);
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
      log.silly(3);
      changeset = getAddPageChangeset(
        filepathCandidates(docPath)[0],
        newPage,
        getDocPagePaths(selectedPagePath, Object.keys(syncStatus.asFiles)),
        parentData,
        selectedPageMediaData.value);

    } else {
      throw new Error("Invalid action when saving page");
    }
    log.silly(4);

    return handleApplyChangeset(changeset, `${verb} ${docPath}`).then(() => {
      if (newPage === null) {
        selectPage(path.dirname(docPath));
      } else {
        selectPage(docPath);
      }
    });
  }

  async function handleChangePath(oldPath: string, newPath: string) {
    log.debug("Moving doc page", oldPath, newPath);

    if (oldPath !== selectedPagePath || !selectedPageData) {
      log.error("Won’t move page: selected page path does not match given");
      throw new Error("Moving page that is not selected")
    }

    const changeset = await getMovePathChangeset(
      getDocPagePaths(oldPath, Object.keys(syncStatus.asFiles)),
      selectedPageData,
      selectedPageHasChildren,
      selectedPageMediaData.value,
      newPath);

    await handleApplyChangeset(changeset, `Move ${oldPath} to ${newPath}`);

    selectPage(newPath);
  }

  return (
    <div css={css`flex: 1; display: flex; flex-flow: row nowrap; overflow: hidden;`}>
      <div css={css`width: 30vw; background: ${Colors.WHITE}`}>
        <Tree
          contents={[nodeTree]}
          onNodeClick={!isBusy ? handleNodeClick : undefined} />
      </div>
      {selectedPagePath
        ? <div css={css`flex: 1; display: flex; flex-flow: column nowrap;`}>
            <DocPageEdit
              React={React}
              key={selectedPagePath}
              useDocPageData={useDocPageData}
              useObjectData={useObjectData}
              path={selectedPagePath}
              onSave={!isBusy ? handleSavePage : undefined}
              onUpdatePath={handleChangePath}
              onJumpToPage={selectPage}
              getPageTitleAtPath={(path) => (occupiedURLs[path] || null)}
              mediaData={selectedPageMediaData.value}
            />
          </div>
        : <NonIdealState title="No page is selected" />}
    </div>
  );
};


type DocPageSaveHandler = (
  docPath: string,
  oldPage: SourceDocPageData | null,
  newPage: SourceDocPageData | null,
) => Promise<void>
const DocPageActions: React.FC<{
  docPath: string
  childPages: ITreeNode[]
  pageData: SourceDocPageData
  syncStatus?: FileChangeType
  onSavePage?: DocPageSaveHandler
}> =
function ({ childPages, syncStatus, docPath, pageData, onSavePage }) {
  const occupiedChildPaths = childPages.map(c => path.basename(c.id as string));
  const newID: string = occupiedChildPaths.indexOf('new-page') >= 0
    ? `new-page-${occupiedChildPaths.filter(p => p.startsWith('new-page')).length}`
    : 'new-page';

  return (
    <ButtonGroup minimal>
      {onSavePage
        ? <>
            <Button
              small disabled={!onSavePage || childPages.length > 0 || docPath.split('/').length <= 1}
              icon="remove"
              title="Remove page"
              onClick={() => {
                onSavePage!(docPath, pageData, null);
              }}
            />
            <Button
              small icon="add"
              title="Add page"
              disabled={!onSavePage}
              onClick={() => {
                onSavePage!(`${docPath}/${newID}`, null, {
                  title: "New page",
                  media: [],
                  redirectFrom: [],
                });
              }}
            />
          </>
        : null}
      <Button
        disabled
        small
        title={syncStatus !== 'unchanged' && syncStatus !== undefined
          ? `This page has been ${syncStatus} since last synchronization`
          : undefined}
        icon={syncStatus === 'unchanged' ? 'tick-circle' : 'asterisk'}
      />
    </ButtonGroup>
  );
};

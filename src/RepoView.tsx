/** @jsx jsx */
/** @jsxFrag React.Fragment */

import log from 'electron-log';
import React from 'react';
import { css, jsx } from '@emotion/core';

import { Button, ButtonGroup, Colors, ITreeNode, NonIdealState, Tree } from '@blueprintjs/core';

import { FileChangeType, RepositoryViewProps } from '@riboseinc/paneron-extension-kit/types';

import { SourceDocPageData } from './types';
import { useDocPageData, useDocPageSyncStatus } from './hooks';
import { DocPageEdit } from './DocPageEdit';
import { getPageChangeset } from './update';


Object.assign(console, log);


export const RepositoryView: React.FC<RepositoryViewProps> =
function ({ React, useObjectData, useObjectSyncStatus, changeObjects }) {

  //log.debug("Rendering Doc site repository view");

  const [selectedPagePath, selectPage] = React.useState<string | undefined>(undefined);

  const [isBusy, setBusy] = React.useState(false);

  const syncStatus = useDocPageSyncStatus(useObjectSyncStatus);

  //log.debug("Page sync status", syncStatus.value)

  const pageData = useDocPageData(
    useObjectData,
    Object.keys(syncStatus.value).map(path => path.substring(1)));
  //log.debug("Page data", pageData)

  function handleNodeClick(n: ITreeNode) {
    selectPage(n.id as string);
  }

  interface DocPageNodeData { importance?: number, filePath: string }

  const nodes: ITreeNode<DocPageNodeData>[] = Object.entries(pageData.value).
  sort(([path1, _1], [path2, _2]) => path1.localeCompare(path2)).
  map(([path, data]) => {
    const effectivePath = path.replace('/index.yaml', '').replace('.yaml', '');
    return {
      id: effectivePath,
      label: data.title,
      isSelected: selectedPagePath === effectivePath,
      hasCaret: false,
      isExpanded: true,
      secondaryLabel: <DocPageActions
        docPath={effectivePath}
        childPages={[]}
        handleSavePage={!isBusy ? handleSavePage : undefined}
        syncStatus={syncStatus.value[`/${effectivePath}`]}
        pageData={pageData.value[effectivePath]}
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
            pageData={pageData.value[candidate.id as string]}
            handleSavePage={!isBusy ? handleSavePage : undefined}
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

  async function handleSavePage(
      docPath: string,
      oldPage: SourceDocPageData | null,
      newPage: SourceDocPageData | null) {

    if (isBusy) { return; }

    const [changeset, verb] = getPageChangeset(syncStatus, pageData, docPath, oldPage, newPage);

    setBusy(true);

    try {
      log.debug("Saving doc page", docPath, oldPage, newPage);
      await changeObjects(changeset, `${verb} ${docPath}`, true);

    } catch (e) {
      log.error("Error while saving doc page", e, docPath);
      throw e;

    } finally {
      setBusy(false);

      if (newPage === null) {
        selectPage(undefined);
      } else {
        selectPage(docPath);
      }
    }
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
              useDocPageData={useDocPageData}
              useObjectData={useObjectData}
              path={selectedPagePath}
              onSave={!isBusy ? handleSavePage : undefined}
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
  syncStatus?: FileChangeType
  pageData?: SourceDocPageData
  handleSavePage?: DocPageSaveHandler
}> =
function ({ childPages, syncStatus, docPath, pageData, handleSavePage }) {
  const occupiedChildPaths = childPages.map(c => path.basename(c.id as string));
  const newID: string = occupiedChildPaths.indexOf('new-page') >= 0
    ? `new-page-${occupiedChildPaths.filter(p => p.startsWith('new-page')).length}`
    : 'new-page';

  return (
    <ButtonGroup minimal>
      <Button
        small disabled={!handleSavePage || childPages.length > 0 || docPath.split('/').length <= 1}
        icon="remove"
        title="Remove page"
        onClick={() => {
          handleSavePage!(docPath, pageData || null, null);
        }}
      />
      <Button
        small icon="add"
        title="Add page"
        disabled={!handleSavePage}
        onClick={() => {
          handleSavePage!(`${docPath}/${newID}`, null, {
            title: "New page",
            media: [],
            redirectFrom: [],
          });
        }}
      />
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

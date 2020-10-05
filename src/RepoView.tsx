/** @jsx jsx */
/** @jsxFrag React.Fragment */

import log from 'electron-log';
import React from 'react';
import path from 'path';

Object.assign(console, log);

import { ClassNames, css, jsx } from '@emotion/core';
import yaml from 'js-yaml';

import { Button, ButtonGroup, Classes, Colors, ITreeNode, NonIdealState, Tree } from '@blueprintjs/core';

import Editor from '@riboseinc/reprose/author/editor';
import editorProps, { MenuWrapper } from './prosemirror/editor';

import {
  FileChangeType,
  ObjectDataRequest, ObjectSyncStatusHook,
  PluginFC, RepositoryViewProps, ValueHook,
} from '@riboseinc/paneron-extension-kit/types';
import { isProseMirrorStructure, SourceDocPageData } from './types';



type DocPageDataHook = (paths: string[]) => ValueHook<Record<string, SourceDocPageData>>;


export const RepositoryView: React.FC<RepositoryViewProps> =
function ({ React, useObjectData, useObjectSyncStatus, changeObjects }) {

  log.info("Rendering Doc site repository view")
  const useDocPageSyncStatus = (): ReturnType<ObjectSyncStatusHook> & { asFiles: Record<string, FileChangeType> } => {
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

  const useDocPageData: DocPageDataHook = (paths: string[]) => {
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
      return { [filepathToDocsPath(path)]: item };
    }).
    reduce((p, c) => ({ ...p, ...c }), {});

    return {
      ...data,
      value: parsedData
    };
  };

  function handleNodeClick(n: ITreeNode) {
    selectPage(n.id as string);
  }

  const [selectedPagePath, selectPage] = React.useState<string | undefined>(undefined);

  const [isBusy, setBusy] = React.useState(false);

  const syncStatus = useDocPageSyncStatus();
  //log.debug("Page data", syncStatus)

  const pageData = useDocPageData(Object.keys(syncStatus.value).map(path => path.substring(1)));
  //log.debug("Page data", pageData)

  function makeAddChildPageButton(docPath: string, occupiedChildPaths: string[]): JSX.Element {
    const newID: string = occupiedChildPaths.indexOf('new-page') >= 0
      ? `new-page-${occupiedChildPaths.filter(p => p.startsWith('new-page')).length}`
      : 'new-page';

    return <Button
      small icon="add"
      title="Add page"
      disabled={isBusy}
      onClick={() => {
        handleSavePage(`${docPath}/${newID}`, null, {
          title: "New page",
          media: [],
          redirectFrom: [],
        });
      }}
    />;
  }
  function makeDeletePageButton(docPath: string): JSX.Element {
    return <Button
      small disabled={isBusy}
      icon="remove"
      title="Remove page"
      onClick={() => {
        handleSavePage(docPath, pageData.value[docPath] || null, null);
      }}
    />;
  }
  function makePageActions(docPath: string, children: ITreeNode[]): JSX.Element {
    return <ButtonGroup minimal>
      {(children.length > 0 || docPath.split('/').length <= 1)
        ? null
        : makeDeletePageButton(docPath)}
      {makeAddChildPageButton(docPath, children.map(c => c.id as string))}
    </ButtonGroup>
  }

  const nodes: ITreeNode[] = Object.entries(pageData.value).
  sort(([path1, _1], [path2, _2]) => path1.localeCompare(path2)).
  map(([path, data]) => {
    const effectivePath = path.replace('/index.yaml', '').replace('.yaml', '');
    return {
      id: effectivePath,
      label: data.title,
      isSelected: selectedPagePath === effectivePath,
      isExpanded: true,
      secondaryLabel: makePageActions(effectivePath as string, []),
      data: { importance: data.importance },
    };
  });
  //log.debug("Nodes", nodes)

  const nodeTree: ITreeNode = nodes.reduce((prev, curr) => {
    const prevID = prev.id as string;
    const currID = curr.id as string;

    if (prevID === currID) {
      return curr;
    }

    const currPathParts = currID.split('/');

    function attachToParent(candidates: ITreeNode[]) {
      for (const candidate of candidates) {
        const candidateParts = (candidate.id as string).split('/');
        if (JSON.stringify(currPathParts.slice(0, -1)) === JSON.stringify(candidateParts)) {
          candidate.childNodes ||= [];
          candidate.childNodes!.push(curr);
          candidate.secondaryLabel = makePageActions(candidate.id as string, candidate.childNodes);
        } else {
          attachToParent(candidate.childNodes || []);
        }
      }
    }
    attachToParent([prev]);
    return prev;

  }, { id: 'docs', label: "Docs", childNodes: [] } as ITreeNode);
  //log.debug("Node hierarchy", nodeTree)

  async function handleSavePage(
      docPath: string,
      oldPage: SourceDocPageData | null,
      newPage: SourceDocPageData | null) {
    if (isBusy) { return; }

    //const verb: string = oldPage === null
    //  ? 'Create'
    //  : newPage === null
    //    ? 'Delete'
    //    : 'Update';

    setBusy(true);

    try {
      log.debug("Saving doc page", docPath, oldPage, newPage);

      log.debug("Obtaining file path for", docPath);

      if (oldPage !== null) {
        let filePath: string | undefined = undefined;

        log.debug("Page is being updated", docPath);

        const children = Object.keys(pageData).find(path => path.startsWith(docPath)) || [];
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

          await changeObjects({
            [filePath]: {
              encoding: 'utf-8',
              oldValue: undefined,
              newValue: null,
            },
          }, `Delete ${docPath}`, true);

        } else {
          if (children.length > 0 && pathCandidateSyncStatus.flat.status === undefined) {
            log.warn("Will move page");

            log.warn("Need to move media");
            // TODO: moveMedia()

            await changeObjects({
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
            }, `Update ${docPath}`, true);

          } else {
            await changeObjects({
              [filePath]: {
                encoding: 'utf-8',
                oldValue: undefined,
                newValue: yaml.dump(newPage, { noRefs: true }),
              },
            }, `Update ${docPath}`, true);
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

        await changeObjects({
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
        }, `Create ${docPath}`, true);

      } else {
        log.error("Unknown action: not saving, creating or deleting a page", docPath, oldPage, newPage);
      }

    } catch (e) {
      log.error("Error while savind doc page", e, docPath);
      throw e;

    } finally {
      setBusy(false);
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
              path={selectedPagePath}
              onSave={!isBusy ? handleSavePage : undefined}
            />
          </div>
        : <NonIdealState title="No page is selected" />}
    </div>
  );
};


const DocPageEdit: PluginFC<{
  path: string
  useDocPageData: DocPageDataHook
  onSave?: (path: string, oldPage: SourceDocPageData, newDoc: SourceDocPageData) => void
}> =
function ({ React, useDocPageData, path, onSave }) {
  const data = useDocPageData([path]);
  const originalPage: SourceDocPageData | undefined = data.value[path];

  const [resetCounter, updateResetCounter] = React.useState(0);
  const [editedPage, updateEditedPage] = React.useState<null | SourceDocPageData>(null);

  const page: SourceDocPageData | null = editedPage || originalPage || null;

  function handleSave() {
    if (originalPage !== undefined && editedPage !== null && onSave) {
      onSave(path, originalPage, editedPage);
    }
  }

  function handleDiscard() {
    if (originalPage !== undefined && editedPage !== null) {
      updateEditedPage(null);
      updateResetCounter(c => c + 1);
    }
  }

  let initialDoc: Record<string, any> | null;

  //log.debug("Doc page data", pageData);

  if (originalPage?.contents && isProseMirrorStructure(originalPage.contents)) {
    initialDoc = originalPage.contents.doc;
  } else {
    log.error("Invalid ProseMirror structure", originalPage?.contents);
    initialDoc = null;
  }

  //log.debug("Doc page contents", contents);

  return (
    <div css={css`flex: 1; display: flex; flex-flow: column nowrap; overflow: hidden;`}>

      <ClassNames>
        {({ css, cx }) => (
          <Editor
            key={`${path}=${JSON.stringify(initialDoc)}-${resetCounter}`}
            onChange={onSave ?
              ((newDoc) => updateEditedPage({ ...page, contents: { doc: newDoc } }))
              : undefined}
            initialDoc={initialDoc || PROSEMIRROR_DOC_STUB}
            css={css`flex: 1; overflow-y: auto; padding: 1rem; background: ${Colors.GRAY5}`}
            proseMirrorClassName={`
              ${Classes.ELEVATION_3}
              ${css({
                borderRadius: '.3rem !important',
                padding: '1.5rem !important',
              })}
            `}
            logger={log}
            {...editorProps}
          />
        )}
      </ClassNames>

      <MenuWrapper>
        <ButtonGroup>
          <Button intent="success" disabled={!onSave || editedPage === null} onClick={handleSave}>
            Commit new version
          </Button>
          <Button disabled={editedPage === null} onClick={handleDiscard}>
            Discard
          </Button>
        </ButtonGroup>
      </MenuWrapper>

      {/*
        <pre css={{ fontSize: '80%', overflowY: 'auto', height: '20vh' }}>
          {editedContents ? JSON.stringify(editedContents, undefined, 4) : null}
        </pre>
      */}

    </div>
  );
};


const PROSEMIRROR_DOC_STUB = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [] },
  ],
};


/* Returns two candidates: first with index.yaml, second without.
   This is more for supporting repositories created outside the extension,
   since we always use `index.yaml` here. */
function filepathCandidates(forDocPath: string): [string, string] {
  return [
    `${forDocPath}/index.yaml`,
    `${forDocPath}.yaml`,
  ];
}


function filepathToDocsPath(filepath: string): string {
  return filepath.replace('/index.yaml', '').replace('.yaml', '');
}


function isDocumentationPage(atPath: string) {
  return (
    atPath !== '/meta.yaml' &&
    !atPath.endsWith('.DS_Store') &&
    !atPath.endsWith('.svg') &&
    !atPath.endsWith('.mp4'));
}

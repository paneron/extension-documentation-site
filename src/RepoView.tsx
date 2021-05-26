/** @jsx jsx */
/** @jsxFrag React.Fragment */

import log from 'electron-log';
import React, { useContext, useEffect, useState } from 'react';
import { css, jsx } from '@emotion/core';

import {
  Classes, Colors,
  NonIdealState, Tree, TreeNodeInfo,
} from '@blueprintjs/core';

import { DatasetContext } from '@riboseinc/paneron-extension-kit/context';

import { SourceDocPageData } from './types';
import { useSiteSettings } from './hooks';
import { DocPageEdit } from './DocPageEdit';
import { SiteSettings } from './SiteSettings';
import PageSection from './PageSection';


Object.assign(console, log);


export default function () {
  //log.debug("Rendering Doc site repository view");

  const {
    useObjectData,
    useFilteredIndex,
    useIndexDescription,
    getFilteredIndexPosition,
    getObjectPathFromFilteredIndex,
  } = useContext(DatasetContext);

  const allPageIndexRequest = useFilteredIndex({
    queryExpression: `return objPath.endsWith(".yaml")`,
  });
  const indexID: string = allPageIndexRequest.value.indexID ?? '';

  const indexDescReq = useIndexDescription({ indexID });
  const itemCount = indexDescReq.value.status.objectCount;
  //const indexProgress = indexDescReq.value.status.progress;

  const settingsData = useSiteSettings(useObjectData);

  const urlPrefix = settingsData.value?.docsURLPrefix || '';

  const [selectedPagePath, selectPage] = useState<string>('/docs');
  const [selectedPageIdx, selectPageIdx] = useState<number>(0);

  useEffect(() => {
    if (indexID !== '') {
      getFilteredIndexPosition({ indexID, objectPath: selectedPagePath }).then(({ position }) => {
        if (selectedPageIdx !== position && position !== null) {
          selectPageIdx(position);
        }
      });
    }
  }, [selectedPagePath, indexID]);

  function selectPageByIndex(position: number) {
    getObjectPathFromFilteredIndex({ indexID, position }).then(({ objectPath }) => {
      if (objectPath !== '' && objectPath !== selectedPagePath) {
        selectPage(objectPath);
      }
    });
  }

  //const selectedPageChildrenIndexRequest = useFilteredIndex({
  //  queryExpression: `return (objPath.startsWith("${selectedPagePath}") && objPath.endsWith(".yaml"))`,
  //});
  //const selectedPageChildrenIndexID = selectedPageChildrenIndexRequest.value.indexID ?? ''
  //const selectedPageChildrenIndexDescriptionReq = useIndexDescription({
  //  indexID: selectedPageChildrenIndexID,
  //});
  //const selectedPageChildrenIndexItemCount = selectedPageChildrenIndexDescriptionReq.value.status.objectCount;

  //log.debug("Page sync status", syncStatus.value)

  //const allPageData = useDocPageData(
  //  useObjectData,
  //  Object.keys(syncStatus.value));

  //const selectedPageData: SourceDocPageData | null = allPageData.value[selectedPagePath] || null;

  const selectedPageData = (useObjectData({
    objectPaths: [selectedPagePath],
  }).value.data[selectedPagePath] ?? null) as SourceDocPageData | null;

  // let docPageFilePath: string | undefined;
  // try {
  //   docPageFilePath = getDocPagePaths(selectedPagePath, allFiles).pathInUse;
  // } catch (e) {
  //   docPageFilePath = undefined;
  // }
  // const selectedPageMediaData = useDocPageMedia(
  //   useObjectData,
  //   selectedPageData?.media || [],
  //   docPageFilePath);

  // const selectedPageChildren = Object.keys(allPageData.value).
  // filter(path => path.startsWith(`${selectedPagePath}/`)) || [];

  // const selectedPageHasChildren = selectedPagePath
  //   ? selectedPageChildren.length > 0
  //   : false;

  // function handleNodeClick(n: ITreeNode) {
  //   selectPage(n.id as string);
  // }

  //interface DocPageNodeData { importance?: number, filePath: string }

  // const occupiedURLs: { [url: string]: string } = Object.entries(allPageData.value).
  // map(([p, data]) => {
  //   let urlsOccupiedByThisPage: { [url: string]: string } = { [p]: data.title };
  //   for (const redirectedURL of (data.redirectFrom || [])) {
  //     urlsOccupiedByThisPage[redirectedURL] = data.title;
  //   }
  //   return urlsOccupiedByThisPage;
  // }).reduce((p, c) => ({ ...p, ...c }), {});

  const nodes: TreeNodeInfo<Record<never, never>>[] = [...new Array(itemCount)].
  map((_, idx) => idx).
  map(idx => ({
    id: idx,
    isSelected: idx === selectedPageIdx,
    label: indexID !== ''
      ? <DocPageNavLabel
          pos={idx}
          indexID={indexID}
          onSelect={(objectPath) => selectPage(objectPath)}
        />
      : <span className={Classes.SKELETON}>Loading…</span>,
  }));

  // const nodes: ITreeNode<DocPageNodeData>[] = Object.entries(allPageData.value).
  // sort(([path1, _1], [path2, _2]) => path1.localeCompare(path2)).
  // map(([path, data]) => {
  //   const effectivePath = path.replace('/index.yaml', '').replace('.yaml', '');
  //   const isSelected = selectedPagePath === effectivePath;
  //   return {
  //     id: effectivePath,
  //     label: <PageLabelInNav indexPos={pos} />,
  //     isSelected,
  //     hasCaret: false,
  //     isExpanded: true,
  //     data: { importance: data.importance, filePath: path },
  //   };
  // });
  //log.debug("Nodes", nodes)

  //const nodeTree: ITreeNode<DocPageNodeData> = nodes.reduce((prev, curr) => {
  //  const prevID = prev.id as string;
  //  const currID = curr.id as string;

  //  if (prevID === currID) {
  //    return curr;
  //  }

  //  const currPathParts = currID.split('/');

  //  function attachToParent(candidates: ITreeNode<DocPageNodeData>[]) {
  //    for (const candidate of candidates) {
  //      const candidateParts = (candidate.id as string).split('/');
  //      if (JSON.stringify(currPathParts.slice(0, -1)) === JSON.stringify(candidateParts)) {
  //        candidate.childNodes ||= [];
  //        candidate.childNodes!.push(curr);
  //      } else {
  //        attachToParent(candidate.childNodes || []);
  //      }
  //    }
  //  }
  //  attachToParent([prev]);
  //  return prev;

  //}, {
  //  id: 'docs',
  //  label: "Docs",
  //  isExpanded: true,
  //  childNodes: [],
  //  data: { filePath: '/docs/index.yaml' },
  //} as ITreeNode<DocPageNodeData>);
  ////log.debug("Node hierarchy", nodeTree)

  // async function handleApplyChangeset(changeset: ObjectChangeset, message: string) {
  //   log.debug("Applying changeset", changeset, message);
  //   if (isBusy || !updateObjects) { return; }

  //   setBusy(true);
  //   try {
  //     log.silly("Applying changeset…");
  //     await updateObjects({
  //       commitMessage: message,
  //       objectChangeset: changeset,
  //       _dangerouslySkipValidation: true,
  //     });
  //   } catch (e) {
  //     log.error("Got error while applying changeset", e, message);
  //     throw e;
  //   } finally {
  //     setBusy(false);
  //   }
  // }

  // async function handleAddMedia(): Promise<string[]> {
  //   if (!selectedPageData) {
  //     throw new Error("Selected page data could not be found");
  //   }
  //   if (!requestFileFromFilesystem) {
  //     // TODO: read-only dataset should not necessarily prevent file selection
  //     throw new Error("Unable to request file from user’s machine: dataset is read-only");
  //   }
  //   const filePaths = getDocPagePaths(selectedPagePath, allFiles);
  //   const selectedFiles: BufferDataset = await requestFileFromFilesystem({
  //     prompt: "Choose images to add to this page’s media",
  //     allowMultiple: false,
  //     filters: [{ name: "PNG and JPEG images", extensions: ['png', 'jpeg', 'jpg'] }],
  //   });

  //   log.info("Got files", selectedFiles);

  //   const newPage = {
  //     ...selectedPageData,
  //     media: [
  //       ...(selectedPageData.media || []),
  //       ...Object.keys(selectedFiles),
  //     ],
  //   };
  //   const pageChangeset = getUpdatePageChangeset(
  //     filePaths,
  //     selectedPageHasChildren,
  //     newPage)

  //   const mediaChangeset = getAddMediaChangeset(
  //     path.dirname(filePaths.pathInUse),
  //     selectedFiles);

  //   const changeset = {
  //     ...pageChangeset,
  //     ...mediaChangeset,
  //   };

  //   await handleApplyChangeset(changeset, `Add media to ${selectedPagePath}`);

  //   return Object.keys(selectedFiles);
  // }

  // async function handleDeleteMedia(idx: number) {
  //   if (!selectedPageData) {
  //     throw new Error("Selected page data could not be found");
  //   }

  //   const mediaFilename = (selectedPageData.media || [])[idx];

  //   if (mediaFilename === undefined) {
  //     log.error("Deleting media: no media at given position", idx);
  //     throw new Error("Cannot delete media: item at given position does not exist");
  //   }

  //   const filePaths = getDocPagePaths(selectedPagePath, allFiles);
  //   const mediaPath = path.posix.join(path.dirname(filePaths.pathInUse), mediaFilename);
  //   const mediaData = selectedPageMediaData.value.data[mediaPath.replace(/^\//, '')];

  //   if (mediaData === null || mediaData === undefined) {
  //     log.error("Deleting media: cannot read data for media at given position",
  //       idx, mediaPath, selectedPageMediaData.value, mediaData);
  //     throw new Error("Cannot delete media: cannot read data for media at given position");
  //   }

  //   const newPage = update(selectedPageData, {
  //     media: {
  //       $set: update(selectedPageData!.media, { $splice: [[idx, 1]] }),
  //     },
  //   })

  //   const pageChangeset = getUpdatePageChangeset(
  //     filePaths,
  //     selectedPageHasChildren,
  //     newPage,
  //   );

  //   const mediaChangeset = getUpdateMediaChangeset(
  //     [mediaFilename],
  //     { [mediaPath]: mediaData },
  //     path.dirname(filePaths.pathInUse),
  //     null);

  //   const changeset = {
  //     ...pageChangeset,
  //     ...mediaChangeset,
  //   };

  //   return await handleApplyChangeset(changeset, `Delete media #${idx} from ${selectedPagePath}`);
  // }

  // function handleSavePage(
  //     docPath: string,
  //     oldPage: SourceDocPageData | null,
  //     newPage: SourceDocPageData | null) {

  //   log.debug("Updating doc page", docPath, oldPage, newPage);

  //   let changeset: ObjectChangeset;
  //   let verb: string;

  //   if (oldPage !== null && newPage !== null) {
  //     const filePaths = getDocPagePaths(docPath, allFiles);
  //     verb = "Update";
  //     changeset = getUpdatePageChangeset(
  //       filePaths,
  //       selectedPageHasChildren,
  //       newPage)

  //   } else if (oldPage !== null) {
  //     const filePaths = getDocPagePaths(docPath, allFiles);
  //     if (!selectedPageData || docPath !== selectedPagePath || yaml.dump(oldPage) !== yaml.dump(selectedPageData)) {
  //       throw new Error("Cannot delete a page that is not selected");
  //     }
  //     verb = "Delete";
  //     log.debug("Selected page media", selectedPageMediaData.value);
  //     log.debug("Selected page has children", selectedPageHasChildren);
  //     changeset = getDeletePageChangeset(
  //       filePaths,
  //       selectedPageData,
  //       selectedPageMediaData.value,
  //       selectedPageHasChildren)

  //   } else if (newPage !== null) {
  //     verb = "Create";
  //     const parentDocPath = path.dirname(docPath);
  //     if (parentDocPath !== selectedPagePath) {
  //       throw new Error("Mismatching parent page paths");
  //     }
  //     const parentData = allPageData.value[selectedPagePath];
  //     if (!parentData) {
  //       throw new Error("Unable to get parent page data when creating a page");
  //     }
  //     changeset = getAddPageChangeset(
  //       filepathCandidates(docPath)[0],
  //       newPage,
  //       getDocPagePaths(selectedPagePath, Object.keys(syncStatus.asFiles)),
  //       parentData,
  //       selectedPageMediaData.value);

  //   } else {
  //     throw new Error("Invalid action when saving page");
  //   }

  //   return handleApplyChangeset(changeset, `${verb} ${docPath}`).then(() => {
  //     if (newPage === null) {
  //       selectPage(path.dirname(docPath));
  //     } else {
  //       selectPage(docPath);
  //     }
  //   });
  // }

  // async function handleChangePath(oldPath: string, newPath: string, leaveRedirect: boolean) {
  //   log.debug("Moving doc page", oldPath, newPath, selectedPageMediaData.value);

  //   if (oldPath !== selectedPagePath || !selectedPageData) {
  //     log.error("Won’t move page: selected page path does not match given");
  //     throw new Error("Moving page that is not selected")
  //   }

  //   const pageData = { ...selectedPageData };

  //   if (leaveRedirect) {
  //     pageData.redirectFrom ||= [];
  //     pageData.redirectFrom.push(oldPath);
  //   }

  //   const changeset = await getMovePathChangeset(
  //     getDocPagePaths(oldPath, Object.keys(syncStatus.asFiles)),
  //     pageData,
  //     selectedPageHasChildren,
  //     selectedPageMediaData.value,
  //     newPath);

  //   await handleApplyChangeset(changeset, `Move ${oldPath} to ${newPath}`);

  //   selectPage(newPath);
  // }

  // if (itemCount < 1) {
  //   return <NonIdealState
  //     icon="clean"
  //     title="There are no documentation pages yet."
  //     description={
  //       <Button disabled={isBusy || !updateObjects} intent="success" large onClick={async () => {
  //         if (!updateObjects) { return; }
  //         setBusy(true);
  //         try {
  //           await updateObjects({
  //             commitMessage: "Create top-level page",
  //             objectChangeset: {
  //               '/docs/index.yaml': {
  //                 oldValue: null,
  //                 newValue: FIRST_PAGE_STUB,
  //               },
  //             },
  //           });
  //         } finally {
  //           setBusy(false);
  //         }
  //       }}>
  //         Create top-level page
  //       </Button>
  //     }
  //   />
  // }

  //const readOnly = isBusy || !updateObjects;

  return (
    <div css={css`flex: 1; display: flex; flex-flow: row nowrap; overflow: hidden;`}>
      <div css={css`width: 30vw; min-width: 350px; overflow: hidden; display: flex; flex-flow: column nowrap;`}>
        <div css={css`flex: 1; overflow-y: auto; background: ${Colors.WHITE};`}>
          <Tree
            contents={nodes}
            onNodeClick={(node) => selectPageByIndex(node.id as number)} />
        </div>
        <PageSection title="Site settings" className={Classes.ELEVATION_1}>
          <div css={css`overflow-y: auto; padding: 1rem 1rem .5rem 1rem`}>
            <SiteSettings originalSettings={settingsData} />
          </div>
        </PageSection>
      </div>
      {selectedPageData !== null
        ? <div css={css`z-index: 2; flex: 1; display: flex; flex-flow: column nowrap;`} className={Classes.ELEVATION_2}>
            <DocPageEdit
              key={selectedPagePath}
              pageData={selectedPageData}
              pagePath={selectedPagePath}
              urlPrefix={urlPrefix}

              //onSave={!readOnly ? handleSavePage : undefined}
              //onAddMedia={!readOnly ? handleAddMedia : undefined}
              //onDeleteMedia={(!readOnly) ? handleDeleteMedia : undefined}
              //onUpdatePath={readOnly ? undefined : handleChangePath}
              //onAddSubpage={!readOnly ? (async (newID: string) => {
              //  await handleSavePage!(`${selectedPagePath}/${newID}`, null, {
              //    title: "New page",
              //    media: [],
              //    redirectFrom: [],
              //  });
              //}) : undefined}
              //onDelete={readOnly ? undefined : async () => {
              //  await handleSavePage!(selectedPagePath, selectedPageData, null);
              //}}
            />
          </div>
        : <NonIdealState title="No page is selected" />}
    </div>
  );
};


// const DocPageActions: React.FC<{
//   syncStatus?: FileChangeType
// }> =
// function ({ syncStatus }) {
// 
//   return (
//     <ButtonGroup minimal>
//       <Icon
//         title={syncStatus !== 'unchanged' && syncStatus !== undefined
//           ? `This page has been ${syncStatus} since last synchronization`
//           : undefined}
//         icon={syncStatus === 'unchanged' ? 'tick-circle' : 'asterisk'}
//       />
//     </ButtonGroup>
//   );
// };


const DocPageNavLabel: React.FC<{
  pos: number,
  indexID: string,
  onSelect: (objectPath: string) => void,
}> = function ({ pos, indexID, onSelect }) {
  const { useObjectPathFromFilteredIndex, useObjectData } = useContext(DatasetContext);
  const { value: { objectPath } } = useObjectPathFromFilteredIndex({ position: pos, indexID });
  const data = (useObjectData({ objectPaths: [objectPath] }).value.data[objectPath] ?? null) as SourceDocPageData | null;
  return <>
    {data?.title ?? `Page at ${objectPath}`}
  </>;
}

/** @jsx jsx */
/** @jsxFrag React.Fragment */

import nodePath from 'path';
import update from 'immutability-helper';
import log from 'electron-log';
import { css, jsx } from '@emotion/core';
import React, { useContext, useEffect, useState } from 'react';

import { Hooks } from '@riboseinc/paneron-extension-kit/types';

import {
  Button, ButtonGroup, Colors, ControlGroup,
  H6, InputGroup, NumericInput,
  Menu, Popover, Tag, ContextMenu, Tooltip, Spinner, Dialog, FormGroup, MenuItem, MenuDivider,
} from '@blueprintjs/core';

import { isProseMirrorStructure, SourceDocPageData } from './types';

import { PROSEMIRROR_DOC_STUB } from './util';
import { ContentsEditor, MenuWrapper, SummaryEditor } from './prosemirror/editor';
import { FieldWithErrors, PartialValidator } from './formValidation';
import PageSection from './PageSection';
import { DatasetContext } from '@riboseinc/paneron-extension-kit/context';
import { useDocPageMedia } from './hooks';


const validateDocPageData: PartialValidator<SourceDocPageData> = (page) => {
  const title = (page.title || '').trim() === ''
    ? [{ message: "Title must not be empty" }]
    : [];

  return [{
    title,
  }, title.length < 1];
}


const DOCS_ROOT = 'docs';


export const DocPageEdit: React.FC<{
  pagePath: string
  urlPrefix: string

  pageData: SourceDocPageData

  onSave?: (path: string, oldPage: SourceDocPageData, newDoc: SourceDocPageData) => Promise<void>
  onUpdatePath?: (oldPath: string, newPath: string, leaveRedirect: boolean) => Promise<void>
  onAddSubpage?: (newID: string) => Promise<void>
  onAddMedia?: () => Promise<string[]>
  onDeleteMedia?: (idx: number) => Promise<void>
  onDelete?: () => Promise<void>
}> =
function ({
  pageData,
  pagePath,
  urlPrefix,
  onSave, onUpdatePath, onAddSubpage, onDelete, onAddMedia, onDeleteMedia,
}) {

  const { makeAbsolutePath, useFilteredIndex, useIndexDescription, useObjectData } = useContext(DatasetContext);

  const [contentsExpanded, expandContents] = useState<boolean | undefined>(true);

  const [resetCounter, updateResetCounter] = useState(0);

  const childrenIndexRequest = useFilteredIndex({
    queryExpression: `return objPath.startsWith(${pagePath}) && objPath.endsWith(".yaml")`,
  });
  const childrenIndexDescriptionReq = useIndexDescription({
    indexID: childrenIndexRequest.value.indexID ?? '',
  });
  const childrenCount = childrenIndexDescriptionReq.value.status.objectCount;
  const hasChildren = childrenCount > 0;

  const mediaDir = makeAbsolutePath(nodePath.dirname(pagePath));
  const mediaData = useDocPageMedia(useObjectData, pageData.media, pagePath);

  const originalPage = pageData;
  const [editedPage, updateEditedPage] = useState<null | SourceDocPageData>(null);
  const page: SourceDocPageData | null = (onSave ? editedPage : null) || originalPage || null;

  const [editedURL, updateEditedURL] = useState<null | string>(null);
  const canEditURL = onUpdatePath !== undefined && editedPage === null && pagePath !== DOCS_ROOT;
  const url: string = (editedURL || pagePath).replace(DOCS_ROOT, urlPrefix);

  useEffect(() => {
    if (onUpdatePath && pagePath === editedURL) {
      updateEditedURL(null);
    }
    if (onSave && editedPage !== null && JSON.stringify(originalPage) === JSON.stringify(editedPage)) {
      updateEditedPage(null);
    }
  }, [editedURL, JSON.stringify(originalPage), JSON.stringify(editedPage)]);

  const canEdit = page !== null && onSave !== undefined && editedURL === null;

  const [validationErrors, isValid] = editedPage !== null
    ? validateDocPageData(editedPage)
    : [{}, false];

  async function handleSave() {
    if (originalPage !== undefined && editedPage !== null && onSave) {
      await onSave(pagePath, originalPage, editedPage);
    }
  }

  function handleDiscard() {
    if (originalPage !== undefined && editedPage !== null) {
      updateEditedPage(null);
      updateResetCounter(c => c + 1);
    }
  }

  async function handleChangePath(withRedirect: boolean) {
    if (editedURL === null || !onUpdatePath || !hasChildren) {
      return;
    }
    if (withRedirect) {
      log.warn("Want to add redirect from", pagePath, "to", editedURL);
    }
    if (nodePath.dirname(pagePath) !== nodePath.dirname(editedURL)) {
      log.error("Cannot move page because dirnames don’t match!");
      return;
    }

    await onUpdatePath(pagePath, editedURL, withRedirect);
  }

  function handleAddRedirect() {
    if (!page) { return; }
    updateEditedPage({
      ...page,
      redirectFrom: [ ...(page.redirectFrom || []), '' ] });
  }
  function getHandleEditRedirect(idx: number) {
    return function handleEditRedirect(evt: React.FormEvent<HTMLInputElement>) {
      if ((page?.redirectFrom || [])[idx] !== undefined) {
        updateEditedPage(update(page, {
          redirectFrom: {
            $set: update(page!.redirectFrom, {
              [idx]: { $set: evt.currentTarget.value.replace(/^\//, '').replace(/\/$/, '')
            }}),
          },
        }));
      }
    };
  }
  function getHandleDeleteRedirect(idx: number) {
    return function handleEditRedirect() {
      if ((page?.redirectFrom || [])[idx] !== undefined) {
        updateEditedPage(update(page, {
          redirectFrom: {
            $set: update(page!.redirectFrom, { $splice: [[idx, 1]] }),
          },
        }));
      }
    };
  }
  async function handleAddMedia() {
    if (!page || !onAddMedia) { return; }
    await onAddMedia();
  }
  function getHandleDeleteMedia(idx: number) {
    return async function handleDeleteMedia() {
      if ((page?.media || [])[idx] !== undefined &&
          onDeleteMedia !== undefined &&
          Object.keys(mediaData.value.data ?? {}).length > 0) {
        await onDeleteMedia(idx);
      }
    }
  }
  async function handleChooseImage(e: MouseEvent): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      function _selectImage(idx: number) {
        const imageFilename = media[idx];
        //const imagePath = nodePath.join(mediaDir, imageFilename);
        resolve(imageFilename);
      }

      const menu = (
        <Menu>
          {media.map((filename, idx) =>
            <MenuItem key={idx} onClick={() => _selectImage(idx)} text={filename} />)}
        </Menu>
      );

      ContextMenu.show(
        menu,
        { left: e.clientX, top: e.clientY },
        () => reject(undefined));
    });
  }

  const pageMenu = <PageURLMenu
    onChangeURL={!onUpdatePath || editedURL === null || !canEditURL
      ? undefined
      : handleChangePath}
    onAddSubpage={(editedPage === null && editedURL === null) ? onAddSubpage : undefined}
    onDelete={(editedPage === null && editedURL === null && !hasChildren) ? onDelete : undefined}
    onAddRedirect={(editedURL === null) ? handleAddRedirect : undefined}
  />;

  const initialContents: Record<string, any> | null =
    originalPage?.contents && isProseMirrorStructure(originalPage.contents)
      ? originalPage.contents.doc
      : null;

  const initialSummary: Record<string, any> | null =
    originalPage?.summary && isProseMirrorStructure(originalPage.summary)
      ? originalPage.summary.doc
      : null;
  //log.debug("Doc page data", pageData);

  const redirects = page?.redirectFrom || [];
  const media = page?.media || [];

  return (
    <div css={css`flex: 1; display: flex; flex-flow: column nowrap; overflow: hidden;`}>

      <PageSection
          expanded={!contentsExpanded}
          onExpand={(state) => expandContents(!state)}
          title="Meta">
        <div css={css`flex-shrink: 0; padding: .5rem 1rem; overflow: hidden; display: flex; flex-flow: column nowrap; & > :not(:last-child) { margin-bottom: .5rem; }`}>
          <FieldWithErrors errors={validationErrors.title || []}>
            <InputGroup
              fill
              large
              css={css`& input { font-weight: bold; }`}
              placeholder="Page title"
              value={page?.title || ''}
              disabled={!canEdit}
              onChange={canEdit
                ? (evt: React.FormEvent<HTMLInputElement>) =>
                    updateEditedPage({ ...page!, title: evt.currentTarget.value })
                : undefined}
            />
          </FieldWithErrors>

          <FieldWithErrors
              label={`Path: ${nodePath.dirname(`/${url}`).replace(/^\//, '').replace(/\/$/, '')}/`}
              errors={[]}
              helperText={!onUpdatePath
                ? "URL cannot be edited for any page that contains subpages, and for the topmost-level page."
                : undefined}
              inline css={css`.bp3-form-content { flex: 1; }`}>
            <ControlGroup>
              <InputGroup
                fill
                value={nodePath.basename(url)}
                disabled={!canEditURL}
                onChange={(evt: React.FormEvent<HTMLInputElement>) =>
                  updateEditedURL(`${nodePath.dirname(pagePath)}/${evt.currentTarget.value}`)
                }
              />
              <Popover content={pageMenu}>
                <Button intent={editedURL !== null ? 'success' : undefined}>Structure…</Button>
              </Popover>
            </ControlGroup>
          </FieldWithErrors>

          {redirects.map((redirect, idx) => {
            return (
              <FieldWithErrors
                  key={`redirect-${idx}`}
                  helperText={idx === redirects.length - 1
                    ? "Do not include global path prefix, and add no leading and trailing slashes."
                    : undefined}
                  label={<>
                    {redirects.length > 1 ? <Tag round minimal>{idx + 1}</Tag> : null}
                    &ensp;
                    Redirect from: /{urlPrefix ? `${urlPrefix}/` : ''}
                  </>}
                  errors={[]}
                  inline
                  css={css`.bp3-form-content { flex: 1; }`}>
                <ControlGroup>
                  <InputGroup
                    fill
                    value={redirect}
                    disabled={!canEdit}
                    onChange={getHandleEditRedirect(idx)}
                  />
                  <Button disabled={!canEdit} title="Delete this redirect" onClick={getHandleDeleteRedirect(idx)}>Delete</Button>
                </ControlGroup>
              </FieldWithErrors>
            );
          })}

          <FieldWithErrors
              errors={[]}
              label="Importance"
              disabled={!canEdit}
              inline
              css={contentsExpanded ? css`display: none` : undefined}
              helperText="Pages with higher importance number appear before their siblings.">
            <NumericInput
              value={page?.importance || ''}
              onValueChange={(val) => updateEditedPage({ ...page!, importance: val })}
            />
          </FieldWithErrors>

          <div css={contentsExpanded ? css`display: none` : undefined}>
            <PageMedia
              media={media}
              mediaData={mediaData}
              onDelete={!onDeleteMedia || !canEdit || editedPage !== null
                ? undefined
                : (idx) => getHandleDeleteMedia(idx)()}
              onAdd={!onAddMedia || !canEdit || editedPage !== null
                ? undefined
                : handleAddMedia} />
          </div>
        </div>

        <H6
            css={css`
              color: ${Colors.GRAY2}; margin-left: 1rem; margin-top: .5rem;
              ${contentsExpanded ? css`display: none` : ''}
            `}>
          Summary
        </H6>

        <SummaryEditor
          css={contentsExpanded ? css`display: none` : undefined}
          key={`${pagePath}=${JSON.stringify(initialSummary || {})}-${resetCounter}`}
          onChange={canEdit ?
            ((newDoc) => updateEditedPage({ ...page!, summary: { doc: newDoc } }))
            : undefined}
          initialDoc={initialSummary || PROSEMIRROR_DOC_STUB }
          logger={log}
        />
      </PageSection>

      <PageSection
          title="Contents"
          expanded={contentsExpanded}
          onExpand={expandContents}
          css={css`flex: 1; min-height: 30vh`}>
        <ContentsEditor
          css={css`flex: 1;`}
          key={`${pagePath}=${JSON.stringify(initialContents || {})}-${resetCounter}`}
          mediaDir={mediaDir}
          onChooseImageClick={(canEdit && (page?.media || []).length > 0)
            ? handleChooseImage
            : undefined}
          onChange={canEdit
            ? ((newDoc) => updateEditedPage({ ...page!, contents: { doc: newDoc } }))
            : undefined}
          initialDoc={initialContents || PROSEMIRROR_DOC_STUB}
          logger={log}
        />
      </PageSection>

      <MenuWrapper>
        <ButtonGroup>
          <Button
              intent="success"
              disabled={!onSave || editedPage === null || !isValid}
              onClick={handleSave}>
            Commit new version
          </Button>
          <Button disabled={editedPage === null || !onSave} onClick={handleDiscard}>
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


const PageURLMenu: React.FC<{
  onAddSubpage?: (newID: string) => Promise<void>
  onChangeURL?: (withRedirect: boolean) => Promise<void>
  onAddRedirect?: () => void
  onDelete?: () => Promise<void>
}> = function ({ onChangeURL, onAddRedirect, onAddSubpage, onDelete }) {
  const [subpageDialogIsOpen, openSubpageDialog] = useState(false);
  const [subpageID, setSubpageID] = useState('new-page');
  const canCreateSubpage = onAddSubpage && subpageID.trim() !== '';
  async function handleAddSubpage() {
    if (!canCreateSubpage || !onAddSubpage) {
      return;
    }
    await onAddSubpage(subpageID);
    setSubpageID('new-page');
    openSubpageDialog(false);
  }
  return <>
    <Menu>
      <MenuItem icon="document" disabled={!onAddSubpage} onClick={() => openSubpageDialog(true)} text="Add subpage" />
      <MenuItem icon="data-lineage" disabled={!onAddRedirect} onClick={onAddRedirect} text="Redirect another path to this page" />
      <MenuItem icon="flows" disabled={!onChangeURL} onClick={() => onChangeURL!(true)} text="Change URL and leave redirect" />
      <MenuDivider title="Advanced" />
      <MenuItem icon="edit" intent="danger" disabled={!onChangeURL} onClick={() => onChangeURL!(false)} text="Change URL without redirect" />
      <MenuItem icon="trash" intent="danger" disabled={!onDelete} onClick={onDelete} text="Delete this page without redirect" />
    </Menu>
    <Dialog isOpen={subpageDialogIsOpen} title="Add subpage">
      <FormGroup
          label="New page ID"
          intent={subpageID === '' ? 'danger' : undefined}
          helperText="Should contain English characters only, no punctuation or spaces. Used as the last part of subpage URL.">
        <InputGroup
          value={subpageID}
          onChange={evt => setSubpageID(evt.currentTarget.value)}
        />
      </FormGroup>
      <Button
          intent={canCreateSubpage ? 'primary' : undefined}
          disabled={!canCreateSubpage}
          onClick={handleAddSubpage}>
        Add subpage
      </Button>
    </Dialog>
  </>
};


const PageMedia: React.FC<{
  media: string[]
  mediaData: ReturnType<Hooks.Data.GetObjectDataset>
  onAdd?: () => Promise<void>
  onDelete?: (idx: number) => Promise<void>
}> = function ({ media, mediaData, onAdd, onDelete }) {
  if (mediaData.isUpdating) {
    return <Spinner />;
  }
  return (
    <>
      {media.map((mediaFileName, idx) => {
        const hasFile = Object.keys(mediaData.value).find(p => nodePath.basename(p) === mediaFileName) !== undefined;
        return (
          <FieldWithErrors
              key={`media-${idx}`}
              helperText={idx === media.length - 1
                ? "You can use media in page contents by clicking “Insert image” in editor toolbar."
                : undefined}
              label={<>
                {media.length > 1
                  ? <Tag css={css`font-family: monospace`} round minimal>{idx + 1}</Tag>
                  : null}
                &ensp;
                Media:
              </>}
              errors={[]}
              inline
              css={css`margin-bottom: .5em; .bp3-form-content { flex: 1; }`}>
            <ControlGroup>
              <InputGroup fill value={mediaFileName} disabled />
              {!hasFile
                ? <Tooltip content="Media file cannot be found"><Button intent="warning" disabled icon="warning-sign" /></Tooltip>
                : null}
              <Button
                disabled={!onDelete}
                title="Delete media from page"
                onClick={() => onDelete ? onDelete(idx) : void 0}>Delete</Button>
            </ControlGroup>
          </FieldWithErrors>
        );
      })}

      <Button disabled={!onAdd} onClick={onAdd} css={css`margin: 1rem`} icon="media">
        Add media
      </Button>
    </>
  );
};

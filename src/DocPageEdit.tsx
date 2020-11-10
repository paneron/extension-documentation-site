/** @jsx jsx */
/** @jsxFrag React.Fragment */

import nodePath from 'path';
import update from 'immutability-helper';
import log from 'electron-log';
import { css, jsx } from '@emotion/core';
import React, { useEffect, useState } from 'react';

import { ObjectDataHook, RepositoryViewProps } from '@riboseinc/paneron-extension-kit/types';

import {
  Button, ButtonGroup, Colors, ControlGroup,
  H6, InputGroup, NumericInput,
  Menu, Popover, Tag, ContextMenu, Tooltip, Spinner,
} from '@blueprintjs/core';

import { DocPageDataHook } from './hooks';
import { isProseMirrorStructure, SourceDocPageData } from './types';

import { PROSEMIRROR_DOC_STUB } from './util';
import { ContentsEditor, MenuWrapper, SummaryEditor } from './prosemirror/editor';
import { FieldWithErrors, PartialValidator } from './formValidation';
import PageSection from './PageSection';


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
  path: string
  mediaDir: string
  urlPrefix: string

  useObjectData: RepositoryViewProps["useObjectData"]
  useDocPageData: DocPageDataHook

  onSave?: (path: string, oldPage: SourceDocPageData, newDoc: SourceDocPageData) => Promise<void>
  onUpdatePath?: (oldPath: string, newPath: string, leaveRedirect: boolean) => Promise<void>
  onAddSubpage?: () => Promise<void>
  onAddMedia?: () => Promise<string[]>
  onDeleteMedia?: (idx: number) => Promise<void>
  onDelete?: () => Promise<void>

  getPageTitleAtPath: (path: string) => string | null
  mediaData: ReturnType<ObjectDataHook>
}> =
function ({
    useObjectData, useDocPageData,
    path, urlPrefix,
    onSave, onUpdatePath, onAddSubpage, onDelete,
    mediaDir, onAddMedia, onDeleteMedia,
    getPageTitleAtPath,
    mediaData,
}) {
  const [contentsExpanded, expandContents] = useState<boolean | undefined>(true);

  const [resetCounter, updateResetCounter] = useState(0);

  const data = useDocPageData(useObjectData, [path]);
  const originalPage = (data.value[path] || undefined) as SourceDocPageData | undefined;
  const [editedPage, updateEditedPage] = useState<null | SourceDocPageData>(null);
  const page: SourceDocPageData | null = (onSave ? editedPage : null) || originalPage || null;

  const [editedURL, updateEditedURL] = useState<null | string>(null);
  const canEditURL = onUpdatePath !== undefined && editedPage === null && path !== DOCS_ROOT;
  const url: string = (editedURL || path).replace(DOCS_ROOT, urlPrefix);

  useEffect(() => {
    if (onUpdatePath && path === editedURL) {
      updateEditedURL(null);
    }
    if (onSave && editedPage !== null && JSON.stringify(originalPage) === JSON.stringify(editedPage)) {
      updateEditedPage(null);
    }
  }, [editedURL, JSON.stringify(originalPage), JSON.stringify(editedPage)]);

  const editedURLOccupiedByPageWithTitle: string | null = editedURL
    ? getPageTitleAtPath(editedURL)
    : null;

  const canEdit = page !== null && onSave !== undefined && editedURL === null;

  const [validationErrors, isValid] = editedPage !== null
    ? validateDocPageData(editedPage)
    : [{}, false];

  async function handleSave() {
    if (originalPage !== undefined && editedPage !== null && onSave) {
      await onSave(path, originalPage, editedPage);
    }
  }

  function handleDiscard() {
    if (originalPage !== undefined && editedPage !== null) {
      updateEditedPage(null);
      updateResetCounter(c => c + 1);
    }
  }

  async function handleChangePath(withRedirect: boolean) {
    if (editedURL === null || !onUpdatePath) {
      return;
    }
    if (getPageTitleAtPath(editedURL) !== null) {
      return;
    }
    if (withRedirect) {
      log.warn("Want to add redirect from", path, "to", editedURL);
    }
    if (nodePath.dirname(path) !== nodePath.dirname(editedURL)) {
      log.error("Cannot move page because dirnames don’t match!");
      return;
    }

    await onUpdatePath(path, editedURL, withRedirect);
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
      if ((page?.media || [])[idx] !== undefined && onDeleteMedia !== undefined) {
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
            <Menu.Item key={idx} onClick={() => _selectImage(idx)} text={filename} />)}
        </Menu>
      );

      ContextMenu.show(
        menu,
        { left: e.clientX, top: e.clientY },
        () => reject(undefined));
    });
  }

  const pageMenu = <PageURLMenu
    onChangeURL={!onUpdatePath || editedURL === null || !canEditURL || editedURLOccupiedByPageWithTitle !== null
      ? undefined
      : handleChangePath}
    onAddSubpage={editedPage === null && editedURL === null ? onAddSubpage : undefined}
    onDelete={editedPage === null && editedURL === null ? onDelete : undefined}
    onAddRedirect={editedURL === null ? handleAddRedirect : undefined}
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
              helperText={!onUpdatePath
                ? "URL cannot be edited for any page that contains subpages, and for the topmost-level page."
                : undefined}
              errors={editedURLOccupiedByPageWithTitle === null
                ? []
                : [{ message: `This path is occupied by page “${editedURLOccupiedByPageWithTitle}”` }]}
              inline
              css={css`.bp3-form-content { flex: 1; }`}>
            <ControlGroup>
              <InputGroup
                fill
                value={nodePath.basename(url)}
                disabled={!canEditURL}
                onChange={(evt: React.FormEvent<HTMLInputElement>) =>
                  updateEditedURL(`${nodePath.dirname(path)}/${evt.currentTarget.value}`)
                }
              />
              <Popover content={pageMenu}>
                <Button intent={editedURL !== null ? 'success' : undefined}>Structure…</Button>
              </Popover>
            </ControlGroup>
          </FieldWithErrors>

          {redirects.map((redirect, idx) => {
            const editedRedirectOccupiedBy = editedPage === null
              ? null
              : getPageTitleAtPath(redirect);

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
                  errors={editedRedirectOccupiedBy === null || editedRedirectOccupiedBy === originalPage?.title
                    ? []
                    : [{ message: `This path is occupied by page “${editedRedirectOccupiedBy}”` }]}
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
          key={`${path}=${JSON.stringify(initialSummary || {})}-${resetCounter}`}
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
          key={`${path}=${JSON.stringify(initialContents || {})}-${resetCounter}`}
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
  onAddSubpage?: () => Promise<void>
  onChangeURL?: (withRedirect: boolean) => Promise<void>
  onAddRedirect?: () => void
  onDelete?: () => Promise<void>
}> = function ({ onChangeURL, onAddRedirect, onAddSubpage, onDelete }) {
  return <Menu>
    <Menu.Item icon="document" disabled={!onAddSubpage} onClick={onAddSubpage} text="Add subpage" />
    <Menu.Item icon="data-lineage" disabled={!onAddRedirect} onClick={onAddRedirect} text="Redirect another path to this page" />
    <Menu.Item icon="flows" disabled={!onChangeURL} onClick={() => onChangeURL!(true)} text="Change URL and leave redirect" />
    <Menu.Divider title="Advanced" />
    <Menu.Item icon="edit" intent="danger" disabled={!onChangeURL} onClick={() => onChangeURL!(false)} text="Change URL without redirect" />
    <Menu.Item icon="trash" intent="danger" disabled={!onDelete} onClick={onDelete} text="Delete this page without redirect" />
  </Menu>
};


const PageMedia: React.FC<{
  media: string[]
  mediaData: ReturnType<ObjectDataHook>
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

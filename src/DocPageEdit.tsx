/** @jsx jsx */
/** @jsxFrag React.Fragment */

import nodePath from 'path';
import update from 'immutability-helper';
import log from 'electron-log';
import { css, jsx } from '@emotion/core';
import React from 'react';

import { PluginFC, RepositoryViewProps } from '@riboseinc/paneron-extension-kit/types';

import {
  Button, ButtonGroup, Colors, ControlGroup,
  H6, InputGroup, NumericInput,
  Menu, Popover, Tag,
} from '@blueprintjs/core';

import { DocPageDataHook } from './hooks';
import { isProseMirrorStructure, SourceDocPageData } from './types';

import { PROSEMIRROR_DOC_STUB } from './util';
import { ContentsEditor, MenuWrapper, SummaryEditor } from './prosemirror/editor';
import { FieldWithErrors, PartialValidator } from './formValidation';


const validateDocPageData: PartialValidator<SourceDocPageData> = (page) => {
  const title = (page.title || '').trim() === ''
    ? [{ message: "Title must not be empty" }]
    : [];

  return [{
    title,
  }, title.length < 1];
}


const DOCS_ROOT = 'docs';


export const DocPageEdit: PluginFC<{
  path: string

  urlPrefix: string

  useObjectData: RepositoryViewProps["useObjectData"]
  useDocPageData: DocPageDataHook

  onSave?: (path: string, oldPage: SourceDocPageData, newDoc: SourceDocPageData) => Promise<void>
  onUpdatePath?: (oldPath: string, newPath: string, leaveRedirect: boolean) => Promise<void>
  onAddSubpage?: () => Promise<void>
  onDelete?: () => Promise<void>

  getPageTitleAtPath: (path: string) => string | null
  mediaData: { [filename: string]: any }
}> =
function ({
    React, setTimeout, useObjectData, useDocPageData,
    path, urlPrefix,
    onSave, onUpdatePath, onAddSubpage, onDelete,
    getPageTitleAtPath,
}) {
  const [contentsExpanded, expandContents] = React.useState<boolean | undefined>(true);

  const [resetCounter, updateResetCounter] = React.useState(0);

  const data = useDocPageData(useObjectData, [path]);
  const originalPage = (data.value[path] || undefined) as SourceDocPageData | undefined;
  const [editedPage, updateEditedPage] = React.useState<null | SourceDocPageData>(null);
  const page: SourceDocPageData | null = (onSave ? editedPage : null) || originalPage || null;

  const [editedURL, updateEditedURL] = React.useState<null | string>(null);
  const canEditURL = onUpdatePath !== undefined && editedPage === null && path !== DOCS_ROOT;
  const url: string = (editedURL || path).replace(DOCS_ROOT, urlPrefix);

  React.useEffect(() => {
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
  function handleAddRedirect() {
    if (!page) { return; }
    updateEditedPage({
      ...page,
      redirectFrom: [ ...(page.redirectFrom || []), '' ] });
  }

  const pageMenu = <PageURLMenu
    onChangeURL={editedURL === null || !canEditURL || editedURLOccupiedByPageWithTitle !== null
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

  //log.debug("Doc page contents", contents);

  const redirects = page?.redirectFrom || [];

  return (
    <div css={css`flex: 1; display: flex; flex-flow: column nowrap; overflow: hidden;`}>

      <PageSection
          setTimeout={setTimeout}
          expanded={!contentsExpanded}
          onExpand={(state) => expandContents(!state)}
          React={React}
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
              label={`URL path: ${nodePath.dirname(`/${url}`).replace(/^\//, '').replace(/\/$/, '')}/`}
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
                <Button icon="more" intent={editedURL !== null ? 'success' : undefined}/>
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
                    ? "Do not include global URL prefix, and add no leading and trailing slashes."
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
                  <Button title="Delete this redirect" onClick={getHandleDeleteRedirect(idx)}>Delete</Button>
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
          setTimeout={setTimeout}
          title="Contents"
          React={React}
          expanded={contentsExpanded}
          onExpand={expandContents}
          css={css`flex: 1; min-height: 30vh`}>
        <ContentsEditor
          css={css`flex: 1;`}
          key={`${path}=${JSON.stringify(initialContents || {})}-${resetCounter}`}
          onChange={canEdit ?
            ((newDoc) => updateEditedPage({ ...page!, contents: { doc: newDoc } }))
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


const PageSection: PluginFC<{
  title: string | JSX.Element
  expanded?: boolean
  onExpand?: (state: boolean | undefined) => void
  className?: string
}> = function ({ title, expanded, children, onExpand, className }) {
  return (
    <section
        css={css`
          display: flex; flex-flow: column nowrap;
          overflow: hidden;
          position: relative;
          padding-left: 1rem;
          background: ${expanded ? Colors.GRAY3 : Colors.LIGHT_GRAY1};
        `}
        onClick={() => onExpand ? onExpand(true) : void 0}
        className={className}>
      <H6
          css={css`
            height: 1rem; color: ${Colors.WHITE};
            text-transform: uppercase;
            font-size: 90%;
            transform: rotate(-90deg) translateX(-100%);
            transform-origin: top left;
            position: absolute; top: .25rem; left: 0; bottom: 0;
            cursor: default;
          `}>
        {title}
      </H6>
      <div
          css={css`
            flex: 1; overflow: hidden; display: flex; flex-flow: column nowrap;
            background: ${Colors.LIGHT_GRAY5};
          `}>
        {children}
      </div>
    </section>
  );
};


const PageURLMenu: React.FC<{
  onAddSubpage?: () => Promise<void>
  onChangeURL?: (withRedirect: boolean) => Promise<void>
  onAddRedirect?: () => void
  onDelete?: () => Promise<void>
}> = function ({ onChangeURL, onAddRedirect, onAddSubpage, onDelete }) {
  return <Menu>
    <Menu.Item disabled={!onAddSubpage} onClick={onAddSubpage} text="Add subpage" />
    <Menu.Item disabled={!onAddRedirect} onClick={onAddRedirect} text="Redirect another path to this page" />
    <Menu.Item disabled={!onChangeURL} onClick={() => onChangeURL!(true)} text="Change URL and leave redirect" />
    <Menu.Divider title="Advanced" />
    <Menu.Item intent="danger" disabled={!onChangeURL} onClick={() => onChangeURL!(false)} text="Change URL without redirect" />
    <Menu.Item intent="danger" disabled={!onDelete} onClick={onDelete} text="Delete this page without redirect" />
  </Menu>
};

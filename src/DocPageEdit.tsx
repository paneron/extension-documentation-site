/** @jsx jsx */
/** @jsxFrag React.Fragment */

import nodePath from 'path';
import log from 'electron-log';
import { css, jsx } from '@emotion/core';
import React from 'react';

import { PluginFC, RepositoryViewProps } from '@riboseinc/paneron-extension-kit/types';

import {
  Button, ButtonGroup, Colors, ControlGroup, FormGroup,
  H6, IFormGroupProps, InputGroup, Intent, NumericInput
} from '@blueprintjs/core';

import { DocPageDataHook } from './hooks';
import { isProseMirrorStructure, SourceDocPageData } from './types';

import { PROSEMIRROR_DOC_STUB } from './util';
import { ContentsEditor, MenuWrapper, SummaryEditor } from './prosemirror/editor';


function validateDocPageData(page: SourceDocPageData): ValidationResult<Partial<SourceDocPageData>> {
  const title = (page.title || '').trim() === ''
    ? [{ message: "Title must not be empty" }]
    : [];

  return [{
    title,
  }, title.length < 1];
}

type ValidationErrors<T> = { [key in keyof T]: ValidationError[] }
type ValidationResult<T> = [errors: ValidationErrors<T>, isValid: boolean]

interface ValidationError {
  message: string
}

const FieldErrors: React.FC<{ errors: ValidationError[], className?: string }> = function ({ errors, className }) {
  return <ul css={css`margin: 0; padding-left: 1.25em;`} className={className}>
    {errors.map(e => <li>{e.message}</li>)}
  </ul>;
};

const FieldWithErrors: React.FC<{
  errors: ValidationError[]
} & IFormGroupProps> = function ({ errors, helperText, children, ...formGroupProps }) {
  const effectiveHelperText: JSX.Element | undefined = helperText !== undefined || errors.length > 0
    ? <>
        {helperText || null}
        {errors.length > 0 ? <FieldErrors errors={errors} /> : null}
      </>
    : undefined;

  const intent: Intent | undefined = errors.length > 0 ? 'danger' : undefined;

  return <FormGroup
      helperText={effectiveHelperText}
      css={css`margin: 0;`}
      intent={intent}
      {...formGroupProps}>
    {children}
  </FormGroup>;
};


export const DocPageEdit: PluginFC<{
  path: string
  useObjectData: RepositoryViewProps["useObjectData"]
  useDocPageData: DocPageDataHook
  onSave?: (path: string, oldPage: SourceDocPageData, newDoc: SourceDocPageData) => Promise<void>
  onUpdatePath?: (oldPath: string, newPath: string) => Promise<void>
  //onApplyChangeset?: (changeset: ObjectChangeset, message: string) => Promise<void>
  onJumpToPage: (path: string) => void
  getPageTitleAtPath: (path: string) => string | null
  mediaData: { [filename: string]: any }
}> =
function ({
    React, useObjectData, useDocPageData, path,
    onSave, onUpdatePath,
    onJumpToPage, getPageTitleAtPath,
}) {
  const [contentsExpanded, expandContents] = React.useState<boolean | undefined>(true);

  const [resetCounter, updateResetCounter] = React.useState(0);

  const data = useDocPageData(useObjectData, [path]);
  const originalPage = (data.value[path] || undefined) as SourceDocPageData | undefined;
  const [editedPage, updateEditedPage] = React.useState<null | SourceDocPageData>(null);
  const page: SourceDocPageData | null = (onSave ? editedPage : null) || originalPage || null;

  const [editedURL, updateEditedURL] = React.useState<null | string>(null);
  const canEditURL = onUpdatePath !== undefined && editedPage === null && path !== 'docs';
  const url: string = editedURL || path;

  const editedURLOccupiedByPageWithTitle: string | null = editedURL
    ? getPageTitleAtPath(editedURL)
    : null;

  const canEdit = page !== null && onSave !== undefined;

  const [validationErrors, isValid] = editedPage !== null
    ? validateDocPageData(editedPage)
    : [{}, false];

  async function handleSave() {
    if (originalPage !== undefined && editedPage !== null && onSave) {
      await onSave(path, originalPage, editedPage);
      updateEditedPage(null);
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

    await onUpdatePath(path, editedURL);
  }

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

  return (
    <div css={css`flex: 1; display: flex; flex-flow: column nowrap; overflow: hidden;`}>

      <PageSection
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
              label={`URL path: ${nodePath.dirname(`/${url}`).replace(/\/$/, '')}/`}
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
                  updateEditedURL(`${nodePath.dirname(url)}/${evt.currentTarget.value}`)
                }
              />
              {onUpdatePath !== undefined
                ? <ButtonGroup>
                    <Button
                        onClick={() => handleChangePath(true)}
                        disabled={editedURL === null || !canEditURL || editedURLOccupiedByPageWithTitle !== null}
                        intent={editedURL === null || !canEditURL || editedURLOccupiedByPageWithTitle !== null
                          ? undefined
                          : 'success'}>
                      Change with redirect
                    </Button>
                    <Button
                        onClick={() => handleChangePath(false)}
                        disabled={editedURL === null || !canEditURL || editedURLOccupiedByPageWithTitle !== null}
                        intent={editedURL === null || !canEditURL || editedURLOccupiedByPageWithTitle !== null
                          ? undefined
                          : 'warning'}>
                      Change
                    </Button>
                  </ButtonGroup>
                : null}
            </ControlGroup>
          </FieldWithErrors>

          <FieldWithErrors
              errors={[]}
              label="Importance"
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

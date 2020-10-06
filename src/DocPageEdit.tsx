/** @jsx jsx */
/** @jsxFrag React.Fragment */

import log from 'electron-log';
import { css, jsx } from '@emotion/core';

import { PluginFC, RepositoryViewProps } from '@riboseinc/paneron-extension-kit/types';

import { Button, ButtonGroup, Colors, ControlGroup, H6, InputGroup } from '@blueprintjs/core';

import { DocPageDataHook } from './hooks';
import { isProseMirrorStructure, SourceDocPageData } from './types';

import { PROSEMIRROR_DOC_STUB } from './util';
import { ContentsEditor, MenuWrapper, SummaryEditor } from './prosemirror/editor';


export const DocPageEdit: PluginFC<{
  path: string
  useObjectData: RepositoryViewProps["useObjectData"]
  useDocPageData: DocPageDataHook
  onSave?: (path: string, oldPage: SourceDocPageData, newDoc: SourceDocPageData) => Promise<void>
}> =
function ({ React, useObjectData, useDocPageData, path, onSave }) {
  const data = useDocPageData(useObjectData, [path]);
  const [resetCounter, updateResetCounter] = React.useState(0);
  const [editedPage, updateEditedPage] = React.useState<null | SourceDocPageData>(null);
  const [contentsExpanded, expandContents] = React.useState<boolean | undefined>(true);

  const originalPage = (data.value[path] || undefined) as SourceDocPageData | undefined;

  const page: SourceDocPageData | null = (onSave ? editedPage : null) || originalPage || null;

  const canEdit = page !== null && onSave !== undefined;

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
          css={css`${contentsExpanded ? 'flex: 0' : 'flex: 1'}; min-height: 5rem;`}
          title="Meta">
        <div css={css`flex-shrink: 0; padding: .5rem 1rem; overflow: hidden; display: flex; flex-flow: column nowrap; & > :not(:last-child) { margin-bottom: .5rem; }`}>
          <ControlGroup>
            <Button small disabled>URL path</Button>
            <InputGroup readOnly small fill value={path} />
            <Button small disabled>Change</Button>
            <Button small disabled>Change with redirect</Button>
          </ControlGroup>

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
        </div>

        <H6 css={css`color: ${Colors.GRAY2}; margin-left: 1rem; margin-top: .5rem;`}>
          Summary
        </H6>

        <SummaryEditor
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
          css={css`${contentsExpanded ? 'flex: 1' : 'flex: 0'}; min-height: 7rem;`}>
        <ContentsEditor
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
              disabled={!onSave || editedPage === null}
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
            letter-spacing: .05rem;
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

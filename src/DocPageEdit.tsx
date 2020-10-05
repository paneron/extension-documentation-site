/** @jsx jsx */
/** @jsxFrag React.Fragment */

import log from 'electron-log';
import { ClassNames, css, jsx } from '@emotion/core';

import { PluginFC, RepositoryViewProps } from '@riboseinc/paneron-extension-kit/types';

import { DocPageDataHook } from './hooks';
import { isProseMirrorStructure, SourceDocPageData } from './types';

import Editor from '@riboseinc/reprose/author/editor';
import editorProps, { MenuWrapper } from './prosemirror/editor';
import { Button, ButtonGroup, Classes, Colors } from '@blueprintjs/core';
import { PROSEMIRROR_DOC_STUB } from './util';


export const DocPageEdit: PluginFC<{
  path: string
  useObjectData: RepositoryViewProps["useObjectData"]
  useDocPageData: DocPageDataHook
  onSave?: (path: string, oldPage: SourceDocPageData, newDoc: SourceDocPageData) => Promise<void>
}> =
function ({ React, useObjectData, useDocPageData, path, onSave }) {
  const data = useDocPageData(useObjectData, [path]);
  const originalPage: SourceDocPageData | undefined = data.value[path];

  const [resetCounter, updateResetCounter] = React.useState(0);
  const [editedPage, updateEditedPage] = React.useState<null | SourceDocPageData>(null);

  const page: SourceDocPageData | null = editedPage || originalPage || null;

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

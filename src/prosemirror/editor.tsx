/** @jsx jsx */
/** @jsxFrag React.Fragment */

import { ClassNames, css, jsx } from '@emotion/core';
import React from 'react';

import { AnchorButton, Classes, Colors, ControlGroup, Divider, IconName, Tooltip } from '@blueprintjs/core';

import { MenuBarProps, MenuButtonFactory } from '@riboseinc/reprose/author/menu';

import code from '@riboseinc/reprose/features/code/author';
import blocky from '@riboseinc/reprose/features/blocky/author';
import paragraph from '@riboseinc/reprose/features/paragraph/author';
import lists from '@riboseinc/reprose/features/lists/author';

import BaseEditor, { EditorProps } from '@riboseinc/reprose/author/editor';

import featuresToEditorProps from '@riboseinc/reprose/author';

import { contentsSchema, summarySchema } from './schema';
import { Schema } from 'prosemirror-model';


const ICONS: Record<string, IconName> = {
  plain: 'paragraph',
  bullet_list: 'list',
  ordered_list: 'numbered-list',
  lift: 'chevron-left',
  join_up: 'collapse-all',
  code: 'code',
  code_block: 'code-block',
};

const ButtonFactory: MenuButtonFactory = ({ state, dispatch }) => function ({ key, item }) {
  const iconName = ICONS[key];
  return (
    <Tooltip content={item.label} key={key}>
      <AnchorButton
          key={key}
          icon={iconName}
          active={item.active?.(state)}
          disabled={item.enable?.(state) === false}
          onClick={() => item.run(state, dispatch)}>
        {iconName ? null : item.label}
      </AnchorButton>
    </Tooltip>
  );
};

const MenuBar: React.FC<MenuBarProps> = function ({ menu, view }) {
  return (
    <MenuWrapper>
      {Object.entries(menu).map(([ groupID, group ], idx) =>
        <React.Fragment key={idx}>
          {idx > 0 ? <Divider /> : null}
          <ControlGroup key={groupID}>
            {Object.entries(group).map(([ buttonID, button ]) =>
              ButtonFactory(view)({ key: buttonID, item: button }))}
          </ControlGroup>
        </React.Fragment>
      )}

    </MenuWrapper>
  );
};

export const MenuWrapper: React.FC<Record<never, never>> = function ({ children }) {
  return (
    <div css={css`display: flex; flex-flow: row wrap; padding: .5rem 1rem;`}>
      {children}
    </div>
  );
};


const contentsEditorProps = featuresToEditorProps([
  blocky,
  paragraph,
  lists,
  code({ allowBlocks: true }),
], contentsSchema, {
  MenuBar,
});


const summaryEditorProps = featuresToEditorProps([
  code({ allowBlocks: false }),
], summarySchema, {
  MenuBar,
});


type FinalEditorProps<S extends Schema> = Pick<EditorProps<S>, 'initialDoc' | 'onChange' | 'logger'>;


const Editor: React.FC<EditorProps<any>> = function (props) {
  return (
    <ClassNames>
      {({ css, cx }) => (
        <BaseEditor
          css={css`flex: 1; overflow-y: auto; padding: 1rem; background: ${Colors.GRAY5}`}
          autoFocus
          proseMirrorClassName={`
            ${Classes.ELEVATION_3}
            ${css({
              borderRadius: '.3rem !important',
              padding: '1.5rem !important',
            })}
          `}
          {...props}
        />
      )}
    </ClassNames>
  );
};


export const SummaryEditor: React.FC<FinalEditorProps<typeof summarySchema>> = function (props) {
  return (
    <Editor {...summaryEditorProps} {...props} />
  );
};


export const ContentsEditor: React.FC<FinalEditorProps<typeof contentsSchema>> = function (props) {
  return (
    <Editor {...contentsEditorProps} {...props} />
  );
};

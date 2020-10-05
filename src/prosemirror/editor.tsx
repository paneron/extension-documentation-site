/** @jsx jsx */
/** @jsxFrag React.Fragment */

import { css, jsx } from '@emotion/core';
import React from 'react';

import { AnchorButton, ControlGroup, Divider, IconName, Tooltip } from '@blueprintjs/core';

import { MenuBarProps, MenuButtonFactory } from '@riboseinc/reprose/author/menu';

import blocky from '@riboseinc/reprose/features/blocky/author';
import paragraph from '@riboseinc/reprose/features/paragraph/author';
import lists from '@riboseinc/reprose/features/lists/author';

import featuresToEditorProps from '@riboseinc/reprose/author';

import schema from './schema';


const ICONS: Record<string, IconName> = {
  plain: 'paragraph',
  bullet_list: 'list',
  ordered_list: 'numbered-list',
  lift: 'chevron-left',
  join_up: 'collapse-all',
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

const editorProps = featuresToEditorProps([blocky, paragraph, lists], schema, {
  MenuBar,
});

export default editorProps;

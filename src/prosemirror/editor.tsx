/** @jsx jsx */
/** @jsxFrag React.Fragment */

import { ClassNames, css, jsx } from '@emotion/core';
import React from 'react';

import {
  AnchorButton, IButtonProps,
  Classes, Colors,
  ControlGroup, Divider, Tooltip, HTMLSelect, InputGroup, Button,
} from '@blueprintjs/core';

import { MenuBarProps, MenuButtonFactory } from '@riboseinc/reprose/author/menu';

import code from '@riboseinc/reprose/features/code/author';
import blocky from '@riboseinc/reprose/features/blocky/author';
import paragraph from '@riboseinc/reprose/features/paragraph/author';
import section from '@riboseinc/reprose/features/section/author';
import emphasis from '@riboseinc/reprose/features/inline-emphasis/author';
import admonition from '@riboseinc/reprose/features/admonition/author';
import lists from '@riboseinc/reprose/features/lists/author';
import links, { DEFAULT_SCHEMAS, LinkAttributeEditorProps, LinkSchema } from '@riboseinc/reprose/features/links/author';

import BaseEditor, { EditorProps } from '@riboseinc/reprose/author/editor';

import { contentsSchema, summarySchema } from './schema';
import { LinkNodeAttrs } from '@riboseinc/reprose/features/links/schema';
import { FieldWithErrors } from '../formValidation';


// Editors

type FinalEditorProps = Pick<EditorProps<any>,
  'initialDoc'
| 'className'
| 'onChange'
| 'logger'>

export const SummaryEditor: React.FC<FinalEditorProps> = function (props) {
  return (
    <Editor
      schema={summarySchema}
      features={[
        emphasis,
        code({ allowBlocks: false }),
      ]}
      {...props}
    />
  );
};

export const ContentsEditor: React.FC<FinalEditorProps> = function (props) {
  return (
    <ClassNames>
      {({ css, cx }) => (
        <Editor
          schema={contentsSchema}
          features={[
            blocky,
            paragraph,
            section,
            lists,
            admonition,
            emphasis,
            code({ allowBlocks: true }),
            links({
              LinkEditor,
              schemas: {
                ...DEFAULT_SCHEMAS,
                urn: urnLinkSchema,
              },
              floatingLinkEditorClassName: `
                ${Classes.ELEVATION_4}
                ${css({ zIndex: 3, position: 'fixed', borderRadius: '0 .3rem .3rem .3rem', overflow: 'hidden' })}
              `,
            }),
          ]}
          {...props}
        />
      )}
    </ClassNames>
  );
};


// Base editor

const Editor: React.FC<FinalEditorProps & Pick<EditorProps<any>, 'features' | 'schema'>> =
function (props) {
  return (
    <div
        className={props.className}
        css={css`display: flex; flex-flow: column nowrap; overflow: hidden;`}>
      <ClassNames>
        {({ css, cx }) => (
          <BaseEditor
            css={css`flex: 1; overflow-y: auto; padding: 1rem; background: ${Colors.GRAY5};`}
            autoFocus
            MenuBar={MenuBar}
            proseMirrorClassName={`
              ${Classes.ELEVATION_3}
              ${css({
                borderRadius: '.3rem !important',
                padding: '1.5rem !important',
              })}
              ${css`

                [data-admonition-type], [admonition-type], admonition {
                  margin: 1em -1.5rem;
                  padding: 1em 1rem .5rem 1rem;
                  border-left-width: .5rem;
                  border-left-style: solid;
                  background: ${Colors.LIGHT_GRAY4};

                  select {
                    margin-bottom: .5rem;
                  }
                }
                [data-admonition-type=seealso] {
                  border-left-color: ${Colors.BLUE5};
                }
                [data-admonition-type=tip] {
                  border-left-color: ${Colors.GREEN5};
                }
                [data-admonition-type=note] {
                  border-left-color: ${Colors.BLUE5};
                }
                [data-admonition-type=warning] {
                  border-left-color: ${Colors.RED5};
                }
                [data-admonition-caption] {
                  font-weight: bold;
                }

                [data-section-editor] {
                  position: relative;

                  > input::before {
                    content: "ID: ";
                  }

                  > input {
                    position: absolute;
                    border: none;
                    padding: 0;
                    color: ${Colors.GRAY4};
                  }
                }

                section {
                  padding: 0 0 0 1.5rem;
                  margin: 1em 0 0 -1.5rem;

                  &::before {
                    content: "ID: “" attr(id) "”";
                  }

                  > header {
                    font-size: 140%;
                    margin-bottom: 10px;
                  }

                  border-left: .75rem solid ${Colors.LIGHT_GRAY4};
                  section {
                    border-left-color: ${Colors.LIGHT_GRAY3};
                    section {
                      border-left-color: ${Colors.LIGHT_GRAY2};
                    }
                  }
                }

              `}
            `}
            {...props}
          />
        )}
      </ClassNames>
    </div>
  );
};


// Menu bar

const ITEM_BUTTON_PROPS: Record<string, IButtonProps> = {
  plain: { icon: 'paragraph' },
  bullet_list: { icon: 'properties' },
  ordered_list: { icon: 'numbered-list' },
  lift: { icon: 'chevron-left' },
  join_up: { icon: 'collapse-all' },
  code: { icon: 'code' },
  code_block: { icon: 'code-block' },
  admonition: { icon: 'lightbulb' },
  admonition_caption: { icon: 'header'},
  link: { icon: 'link' },
  isoStandardLink: { icon: 'link', text: "ISO" },
  section: { icon: 'insert', text: 'Subsection' },
  section_header: { icon: 'header' },
};

const ButtonFactory: MenuButtonFactory = ({ state, dispatch }) => function ({ key, item }) {
  const buttonProps = ITEM_BUTTON_PROPS[key] || { text: item.label };
  return (
    <Tooltip content={item.label} key={key}>
      <AnchorButton
        active={item.active?.(state)}
        disabled={item.enable?.(state) === false}
        onClick={() => item.run(state, dispatch)}
        key={key}
        {...buttonProps} />
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
    <div css={css`display: flex; flex-flow: row wrap; padding: .5rem 1rem; background: ${Colors.LIGHT_GRAY3}`}>
      {children}
    </div>
  );
};


// Link support

const urnLinkSchema: LinkSchema = {
  entityTypeLabel: "URN",
  resolveReference: async (ref) => {
    if (!ref.startsWith('urn:iso:std')) {
      return { hRef: '' };
    }
    const standardRef = ref.replace(/^urn:/, '');
    return { hRef: `https://www.iso.org/obp/ui/#${standardRef}` };
  },
  validateReference: async (ref) => {
    if (!ref.startsWith('urn:iso:std')) {
      return ["Currently, only ISO standard references are supported"];
    }
    return [];
  },
  sanitizeReference: async (ref) => {
    return ref.toLowerCase().trim();
  }
}


const LinkEditor: React.FC<LinkAttributeEditorProps> = function ({ schemas, attrs, onAttrsChanged }) {
  const [editedAttrs, updateEditedAttrs] = React.useState<LinkNodeAttrs | null>(null);
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  const attr = editedAttrs || attrs;

  async function handleConfirm() {
    const schema = schemas[attrs.schemaID];
    if (editedAttrs && schema) {
      const sanitized = await schema.sanitizeReference(attr.reference);
      onAttrsChanged({ ...editedAttrs, reference: sanitized });
    }
  }

  function openURL(url: string) {
    require('electron').shell.openExternal(url);
  }

  React.useEffect(() => {
    (async () => {

      setValidationErrors([]);

      const schema = schemas[attr.schemaID];

      if (!schema) { return; }

      const sanitized = await schema.sanitizeReference(attr.reference);

      const errors = await schema.validateReference(sanitized);
      setValidationErrors(errors);

      try{
        const { title, hRef } = await schema.resolveReference(sanitized);
        updateEditedAttrs({ ...attr, hRef: hRef || '', title: title || '' });

      } catch (e) {
        updateEditedAttrs({ ...attr, hRef: '' });
      }

    })();
  }, [attr.schemaID, attr.reference]);

  return (
    <div css={css`padding: .5rem; background: ${Colors.LIGHT_GRAY5}; cursor: default`}>
      <FieldWithErrors
          helperText={attr.hRef
            ? <>Resolved as <a onClick={() => openURL(attr.hRef)}>{attr.hRef}</a></>
            : undefined}
          errors={validationErrors.map(e => ({ message: e }))}>
        <ControlGroup>
          <HTMLSelect
            value={attr.schemaID}
            onChange={evt => updateEditedAttrs({ ...attr, schemaID: evt.currentTarget.value })}
            options={Object.entries(schemas).map(([schemaID, schemaOpts]) =>
              ({ value: schemaID, label: schemaOpts.entityTypeLabel }))}
          />
          <InputGroup
            fill
            value={attr.reference}
            onChange={(evt: React.FormEvent<HTMLInputElement>) =>
              updateEditedAttrs({ ...attr, reference: evt.currentTarget.value })}
          />
          <Button disabled={editedAttrs === null} icon="tick" onClick={handleConfirm} />
        </ControlGroup>
      </FieldWithErrors>
    </div>
  );
};

/** @jsx jsx */
/** @jsxFrag React.Fragment */

import { jsx, css } from '@emotion/core';
import { Colors, H6 } from '@blueprintjs/core';
import React from 'react';


const PageSection: React.FC<{
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

export default PageSection;

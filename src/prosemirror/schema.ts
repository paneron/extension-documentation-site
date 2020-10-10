import code from '@riboseinc/reprose/features/code/schema';
import admonition from '@riboseinc/reprose/features/admonition/schema';
import emphasis from '@riboseinc/reprose/features/inline-emphasis/schema';
import paragraph from '@riboseinc/reprose/features/paragraph/schema';
import lists from '@riboseinc/reprose/features/lists/schema';
import links from '@riboseinc/reprose/features/links/schema';

import featuresToSchema from '@riboseinc/reprose/schema';

export const contentsSchema = featuresToSchema([
  paragraph,
  lists,
  admonition,
  emphasis,
  links(),
  code({ allowBlocks: true }),
]);

export const summarySchema = featuresToSchema([
  emphasis,
  code({ allowBlocks: false }),
]);

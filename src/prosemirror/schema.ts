import code from '@riboseinc/reprose/features/code/schema';
import admonition from '@riboseinc/reprose/features/admonition/schema';
import paragraph from '@riboseinc/reprose/features/paragraph/schema';
import lists from '@riboseinc/reprose/features/lists/schema';

import featuresToSchema from '@riboseinc/reprose/schema';

export const contentsSchema = featuresToSchema([
  paragraph,
  lists,
  admonition,
  code({ allowBlocks: true }),
]);

export const summarySchema = featuresToSchema([
  code({ allowBlocks: false }),
]);

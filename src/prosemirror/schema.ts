import code from '@riboseinc/reprose/features/code/schema';
import paragraph from '@riboseinc/reprose/features/paragraph/schema';
import lists from '@riboseinc/reprose/features/lists/schema';

import featuresToSchema from '@riboseinc/reprose/schema';

export const contentsSchema = featuresToSchema([
  paragraph,
  lists,
  code({ allowBlocks: true }),
]);

export const summarySchema = featuresToSchema([
  code({ allowBlocks: false }),
]);

import path from 'path';
import code from '@riboseinc/reprose/features/code/schema';
import admonition from '@riboseinc/reprose/features/admonition/schema';
import emphasis from '@riboseinc/reprose/features/inline-emphasis/schema';
import paragraph from '@riboseinc/reprose/features/paragraph/schema';
import section from '@riboseinc/reprose/features/section/schema';
import lists from '@riboseinc/reprose/features/lists/schema';
import links from '@riboseinc/reprose/features/links/schema';
import image, { FeatureOptions as ImageFeatureOptions } from '@riboseinc/reprose/features/image/schema';
import figure from '@riboseinc/reprose/features/figure/schema';

import featuresToSchema from '@riboseinc/reprose/schema';

export function getImageFeatureOptions(protocol: string, imageDir: string): ImageFeatureOptions {
  return {
    getSrcToShow: (src) => `${protocol}${path.join(imageDir, src)}`,
    getSrcToStore: (src) => src.replace(`${protocol}${imageDir}`, ''),
  };
};

export function getContentsSchema(opts: { protocol: string, imageDir: string }) {
  return featuresToSchema([
    paragraph,
    lists,
    admonition,
    emphasis,
    section,
    image(getImageFeatureOptions(opts.protocol, opts.imageDir)),
    figure,
    links(),
    code({ allowBlocks: true }),
  ]);
}

export const summarySchema = featuresToSchema([
  emphasis,
  code({ allowBlocks: false }),
]);

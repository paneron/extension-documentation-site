import paragraph from '@riboseinc/reprose/features/paragraph/schema';
import lists from '@riboseinc/reprose/features/lists/schema';

import featuresToSchema from '@riboseinc/reprose/schema';

const schema = featuresToSchema([paragraph, lists]);

export default schema;

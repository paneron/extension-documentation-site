export function isDocPageAt(objectPath: string) {
  return (
    objectPath.startsWith('/docs/') &&
    objectPath !== '/meta.yaml' &&
    objectPath.endsWith('.yaml'));
}


export function objectPathToDocsPath(filepath: string): string {
  return filepath.replace('/index.yaml', '').replace('.yaml', '').replace(/^\//, '');
}


/* Returns two candidates: first with index.yaml, second without.
   This is more for supporting repositories created outside the extension,
   since we always use `index.yaml` here. */
export function filepathCandidates(forDocPath: string): [asNested: string, asFlat: string] {
  const pathWithoutLeadingSlash = forDocPath.replace(/^\//, '');
  return [
    `/${pathWithoutLeadingSlash}/index.yaml`,
    `/${pathWithoutLeadingSlash}.yaml`,
  ];
}


/* Returns candidates from `filepathCandidates()`, but specified each under its key
   (“flat” path for /path/to/doc/page.yaml, “nested” path for /path/to/doc/page/index.yaml),
   with `pathInUse` key containing the actually used path
   (checked using given `allFiles`, which should contain a list of all files in the repo
   relative to its root with leading slash).
   Paths will have leading slashes. */
export function getDocPagePaths
(docPath: string, allFiles: string[]):
{ pathInUse: string, nestedPath: string, flatPath: string } {

  const [nestedPath, flatPath] = filepathCandidates(docPath);

  if (allFiles.filter(p => p === nestedPath || p === flatPath).length !== 1) {
    throw new Error("Could not reliably find existing doc page path");
  }

  const result = {
    nestedPath: nestedPath,
    flatPath: flatPath,
  };

  if (allFiles.indexOf(nestedPath) >= 0) {
    return { ...result, pathInUse: nestedPath };
  } else if (allFiles.indexOf(flatPath) >= 0) {
    return { ...result, pathInUse: flatPath };
  } else {
    throw new Error("Could not find existing doc page path");
  }
}


export const PROSEMIRROR_DOC_STUB = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [] },
  ],
};

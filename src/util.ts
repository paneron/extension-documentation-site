export function isDocumentationPage(atPath: string) {
  return (
    atPath.startsWith('/docs/') &&
    atPath !== '/meta.yaml' &&
    atPath.endsWith('.yaml'));
}


export function filepathToDocsPath(filepath: string): string {
  return filepath.replace('/index.yaml', '').replace('.yaml', '');
}


/* Returns two candidates: first with index.yaml, second without.
   This is more for supporting repositories created outside the extension,
   since we always use `index.yaml` here. */
export function filepathCandidates(forDocPath: string): [asNested: string, asFlat: string] {
  return [
    `${forDocPath}/index.yaml`,
    `${forDocPath}.yaml`,
  ];
}


export function getDocPagePaths
(docPath: string, allFiles: string[]):
{ pathInUse: string, nestedPath: string, flatPath: string } {

  const [nestedPath, flatPath] = filepathCandidates(docPath);

  if (allFiles.filter(p => p === `/${nestedPath}` || p === `/${flatPath}`).length !== 1) {
    throw new Error("Could not reliably find existing doc page path");
  }

  const result = {
    nestedPath: nestedPath,
    flatPath: flatPath,
  };

  if (allFiles.indexOf(`/${nestedPath}`) >= 0) {
    return { ...result, pathInUse: nestedPath };
  } else if (allFiles.indexOf(`/${flatPath}`) >= 0) {
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

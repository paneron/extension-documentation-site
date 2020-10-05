/* Returns two candidates: first with index.yaml, second without.
   This is more for supporting repositories created outside the extension,
   since we always use `index.yaml` here. */
export function filepathCandidates(forDocPath: string): [string, string] {
  return [
    `${forDocPath}/index.yaml`,
    `${forDocPath}.yaml`,
  ];
}

export function filepathToDocsPath(filepath: string): string {
  return filepath.replace('/index.yaml', '').replace('.yaml', '');
}

export function isDocumentationPage(atPath: string) {
  return (
    atPath !== '/meta.yaml' &&
    !atPath.endsWith('.DS_Store') &&
    !atPath.endsWith('.svg') &&
    !atPath.endsWith('.mp4'));
}


export const PROSEMIRROR_DOC_STUB = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [] },
  ],
};

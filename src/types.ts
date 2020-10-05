export type SourceDocPageData = {
  importance?: number
  title: string
  summary?: ProseMirrorStructure | string
  contents?: ProseMirrorStructure | string
  excerpt?: string

  media: string[]
  redirectFrom: string[]
}


export type ProseMirrorStructure = { doc: Record<string, any> };


export function isProseMirrorStructure(data: string | ProseMirrorStructure): data is ProseMirrorStructure {
  return data.hasOwnProperty('doc') && ((data as ProseMirrorStructure).doc.type !== undefined);
}

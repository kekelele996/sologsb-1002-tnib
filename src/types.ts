export type Role = 'author' | 'reviewer' | 'editor'
export type ParagraphStatus = 'open' | 'accepted' | 'locked'
export type CommentStatus = 'open' | 'accepted' | 'rejected' | 'merged' | 'minority'
export type CommentType = 'comment' | 'suggestion'
export type ArbitrationStatus = 'active' | 'applied' | 'rejected' | 'superseded'

export interface Reply {
  id: string
  author: string
  role: Role
  body: string
  createdAt: number
}

export interface Comment {
  id: string
  paragraphId: string
  author: string
  role: Role
  type: CommentType
  quote: string
  body: string
  suggestion?: string
  status: CommentStatus
  replies: Reply[]
  createdAt: number
  mergedInto?: string
}

export interface Paragraph {
  id: string
  section: string
  number: string
  text: string
  original: string
  status: ParagraphStatus
  highlighted: boolean
}

export interface Version {
  id: string
  label: string
  createdAt: number
  paragraphs: Paragraph[]
}

export interface EditConflict {
  id: string
  paragraphId: string
  localText: string
  remoteText: string
  localAuthor: string
  remoteAuthor: string
  detectedAt: number
}

export interface Arbitration {
  id: string
  paragraphId: string
  commentIds: string[]
  winnerCommentId: string | null
  mergedText: string | null
  rationale: string
  status: ArbitrationStatus
  baseText: string
  snapshots: Record<string, { quote: string; suggestion: string }>
  createdAt: number
  decidedAt?: number
}

export interface HistorySnapshot {
  paragraphs: Paragraph[]
  comments: Comment[]
  versions: Version[]
  arbitrations: Arbitration[]
}

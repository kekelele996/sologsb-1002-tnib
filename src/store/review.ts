import { create } from 'zustand'
import type { Comment, EditConflict, HistorySnapshot, Paragraph, Reply, Role, Ruling, Version } from '../types'

const DRAFT_KEY = 'sologsb-1002-draft-v1'
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const baseParagraphs: Paragraph[] = [
  { id: 'p-01', section: '摘要', number: '1.', text: '开源软件供应链的稳定性不仅取决于代码质量，也取决于维护者能否持续识别并回应社区需求。', original: '开源软件供应链的稳定性不仅取决于代码质量，也取决于维护者能否持续识别并回应社区需求。', status: 'accepted', highlighted: false },
  { id: 'p-02', section: '1 引言', number: '2.', text: '近年来，大型语言模型被广泛用于代码生成与缺陷定位，但其在真实维护工作流中的影响仍缺少系统证据。', original: '近年来，大型语言模型被广泛用于代码生成与缺陷定位，但其在真实维护工作流中的影响仍缺少系统证据。', status: 'open', highlighted: true },
  { id: 'p-03', section: '1 引言', number: '3.', text: '本文收集 12 个活跃开源项目连续 18 个月的议题记录，并访谈 26 位核心维护者。', original: '本文收集 12 个活跃开源项目连续 18 个月的议题记录，并访谈 26 位核心维护者。', status: 'open', highlighted: true },
  { id: 'p-04', section: '2 方法', number: '4.', text: '我们采用混合研究方法，将议题生命周期划分为响应、评审与合并三个阶段。编码过程由两名研究者独立完成。', original: '我们采用混合研究方法，将议题生命周期划分为响应、评审与合并三个阶段。编码过程由两名研究者独立完成。', status: 'open', highlighted: false },
  { id: 'p-05', section: '2 方法', number: '5.', text: '当编码结果不一致时，研究者通过讨论达成一致；若仍有分歧，则邀请第三位研究者裁决。', original: '当编码结果不一致时，研究者通过讨论达成一致；若仍有分歧，则邀请第三位研究者裁决。', status: 'accepted', highlighted: true },
  { id: 'p-06', section: '3 结果', number: '6.', text: '初步结果显示，辅助工具缩短了首次响应时间，但没有显著降低维护者处理复杂议题的认知负担。', original: '初步结果显示，辅助工具缩短了首次响应时间，但没有显著降低维护者处理复杂议题的认知负担。', status: 'open', highlighted: true },
  { id: 'p-07', section: '3 结果', number: '7.', text: '在高活跃度项目中，维护者更关注建议是否可验证，而非建议生成速度。', original: '在高活跃度项目中，维护者更关注建议是否可验证，而非建议生成速度。', status: 'open', highlighted: false },
]
const baseComments: Comment[] = [
  { id: 'c-01', paragraphId: 'p-02', author: '审稿人 A', role: 'reviewer', type: 'suggestion', quote: '其真实维护工作流中的影响', body: '建议把“影响”具体化为可观察指标。', suggestion: '近年来，大型语言模型被广泛用于代码生成与缺陷定位，但在真实维护工作流中究竟改变了哪些协作行为，仍缺少系统证据。', status: 'open', replies: [{ id: 'r-01', author: '作者', role: 'author', body: '可以，修改后会补充指标定义。', createdAt: Date.now() - 7200000 }], createdAt: Date.now() - 86400000 },
  { id: 'c-02', paragraphId: 'p-02', author: '审稿人 B', role: 'reviewer', type: 'comment', quote: '缺少系统证据', body: '这里的“系统证据”范围过大，建议限定为本研究覆盖的议题语料。', status: 'open', replies: [], createdAt: Date.now() - 64000000 },
  { id: 'c-03', paragraphId: 'p-03', author: '审稿人 A', role: 'reviewer', type: 'comment', quote: '26 位核心维护者', body: '请说明抽样方式和地域分布，避免样本选择偏差。', status: 'open', replies: [], createdAt: Date.now() - 54000000 },
  { id: 'c-04', paragraphId: 'p-04', author: '审稿人 C', role: 'reviewer', type: 'comment', quote: '两名研究者独立完成', body: '建议报告编码者间一致性系数，并明确不一致处理规则。', status: 'open', replies: [], createdAt: Date.now() - 48000000 },
  { id: 'c-05', paragraphId: 'p-05', author: '审稿人 D', role: 'reviewer', type: 'comment', quote: '邀请第三位研究者裁决', body: '与上一段重复：都在说明编码分歧如何解决，建议合并意见。', status: 'open', replies: [], createdAt: Date.now() - 43000000 },
  { id: 'c-06', paragraphId: 'p-06', author: '审稿人 B', role: 'reviewer', type: 'suggestion', quote: '但没有显著降低维护者处理复杂议题的认知负担', body: '“显著”需要给出统计检验与效应量。', suggestion: '初步结果显示，辅助工具缩短了首次响应时间，但对复杂议题处理时长与自我报告认知负担均未产生统计显著影响。', status: 'open', replies: [], createdAt: Date.now() - 36000000 },
  { id: 'c-07', paragraphId: 'p-06', author: '审稿人 C', role: 'reviewer', type: 'suggestion', quote: '没有显著降低维护者处理复杂议题的认知负担', body: '建议保留“显著”的表述，改为补充统计检验方法说明；与审稿人 B 删除“显著”的改法方向冲突，请编辑定夺。', suggestion: '初步结果显示，辅助工具缩短了首次响应时间，但未显著降低维护者处理复杂议题的认知负担（统计检验方法见附录 B）。', status: 'open', replies: [], createdAt: Date.now() - 30000000 },
]
const seed = typeof localStorage !== 'undefined' ? localStorage.getItem(DRAFT_KEY) : null
const parsed = seed ? JSON.parse(seed) as Partial<{ paragraphs: Paragraph[]; comments: Comment[]; versions: Version[]; rulings: Ruling[] }> : null
const initialParagraphs = parsed?.paragraphs?.length ? parsed.paragraphs : baseParagraphs
const initialComments = parsed?.comments ?? baseComments
const initialRulings: Ruling[] = parsed?.rulings ?? []
const initialVersions: Version[] = parsed?.versions ?? [
  { id: 'v-01', label: '投稿初稿 v1', createdAt: Date.now() - 1209600000, paragraphs: JSON.parse(JSON.stringify(baseParagraphs)) as Paragraph[] },
  { id: 'v-02', label: '审阅基线 v2', createdAt: Date.now() - 172800000, paragraphs: JSON.parse(JSON.stringify(baseParagraphs.map((p) => p.id === 'p-04' ? { ...p, text: `${p.text} 编码规则在预注册方案中说明。` } : p))) as Paragraph[] },
]

const persistDraft = (paragraphs: Paragraph[], comments: Comment[], versions: Version[], rulings: Ruling[]) => {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ paragraphs, comments, versions, rulings }))
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

// 裁决指纹：段落正文 + 该段落全部待处理建议的引用与内容。任一变化即视为冲突现场已改变。
const rulingFingerprint = (paragraphId: string, paragraphs: Paragraph[], comments: Comment[]) => {
  const paragraph = paragraphs.find((item) => item.id === paragraphId)
  const suggestions = comments
    .filter((item) => item.paragraphId === paragraphId && item.type === 'suggestion' && item.status === 'open')
    .map((item) => `${item.id}|${item.quote}|${item.suggestion ?? ''}`)
    .sort()
  return JSON.stringify([paragraph?.text ?? '', suggestions])
}
const refreshRulings = (rulings: Ruling[], paragraphs: Paragraph[], comments: Comment[]) =>
  rulings.map((ruling) => ruling.status === 'active' && ruling.fingerprint !== rulingFingerprint(ruling.paragraphId, paragraphs, comments)
    ? { ...ruling, status: 'stale' as const }
    : ruling)

interface ReviewState {
  role: Role
  paragraphs: Paragraph[]
  comments: Comment[]
  versions: Version[]
  rulings: Ruling[]
  selectedParagraphId: string
  commentFilter: 'all' | 'open' | 'suggestion' | 'duplicate'
  revisionMode: boolean
  dirty: boolean
  conflicts: EditConflict[]
  past: HistorySnapshot[]
  future: HistorySnapshot[]
  setRole: (role: Role) => void
  selectParagraph: (id: string) => void
  setCommentFilter: (filter: ReviewState['commentFilter']) => void
  setRevisionMode: (value: boolean) => void
  updateParagraph: (id: string, text: string) => void
  addComment: (input: Pick<Comment, 'paragraphId' | 'type' | 'quote' | 'body' | 'suggestion'>) => void
  replyComment: (commentId: string, body: string) => void
  resolveSuggestion: (commentId: string, accepted: boolean) => void
  mergeComment: (commentId: string, targetId: string) => void
  createRuling: (input: { paragraphId: string; commentIds: string[]; winnerCommentId?: string; mergedText?: string; rationale: string }) => { ok: boolean; reason?: string }
  resolveRuling: (rulingId: string, accepted: boolean) => { ok: boolean; reason?: string }
  toggleLock: (paragraphId: string) => void
  createVersion: (label: string) => void
  addConflict: (conflict: EditConflict) => void
  resolveConflict: (conflictId: string, strategy: 'local' | 'remote') => void
  dismissConflict: (conflictId: string) => void
  undo: () => void
  redo: () => void
  save: () => void
  resetDemo: () => void
}

export const useReviewStore = create<ReviewState>((set, get) => {
  const record = (producer: (state: ReviewState) => Partial<ReviewState>) => set((state) => {
    const history: HistorySnapshot = { paragraphs: clone(state.paragraphs), comments: clone(state.comments), versions: clone(state.versions), rulings: clone(state.rulings) }
    const next = producer(state)
    const paragraphs = next.paragraphs ?? state.paragraphs
    const comments = next.comments ?? state.comments
    const versions = next.versions ?? state.versions
    const rulings = refreshRulings(next.rulings ?? state.rulings, paragraphs, comments)
    persistDraft(paragraphs, comments, versions, rulings)
    return { ...next, rulings, past: [...state.past.slice(-49), history], future: [], dirty: true }
  })

  return {
    role: 'reviewer',
    paragraphs: initialParagraphs,
    comments: initialComments,
    versions: initialVersions,
    rulings: initialRulings,
    selectedParagraphId: 'p-02',
    commentFilter: 'all',
    revisionMode: false,
    dirty: false,
    conflicts: [],
    past: [],
    future: [],
    setRole: (role) => set({ role, selectedParagraphId: get().paragraphs[0]?.id ?? '' }),
    selectParagraph: (selectedParagraphId) => set({ selectedParagraphId }),
    setCommentFilter: (commentFilter) => set({ commentFilter }),
    setRevisionMode: (revisionMode) => set({ revisionMode }),
    updateParagraph: (paragraphId, text) => record((state) => ({
      paragraphs: state.paragraphs.map((paragraph) => paragraph.id === paragraphId && paragraph.status !== 'locked'
        ? { ...paragraph, text, status: 'open' as const, highlighted: true }
        : paragraph),
    })),
    addComment: (input) => record((state) => ({
      comments: [{
        ...input,
        id: id('comment'),
        author: state.role === 'reviewer' ? '审稿人 A' : state.role === 'author' ? '作者' : '编辑',
        role: state.role,
        status: 'open',
        replies: [],
        createdAt: Date.now(),
      }, ...state.comments],
    })),
    replyComment: (commentId, body) => record((state) => ({
      comments: state.comments.map((comment) => comment.id === commentId ? {
        ...comment,
        replies: [...comment.replies, { id: id('reply'), author: state.role === 'author' ? '作者' : state.role === 'reviewer' ? '审稿人 A' : '编辑', role: state.role, body, createdAt: Date.now() } as Reply],
      } : comment),
    })),
    resolveSuggestion: (commentId, accepted) => record((state) => {
      const comment = state.comments.find((item) => item.id === commentId)
      return {
        comments: state.comments.map((item) => item.id === commentId ? { ...item, status: accepted ? 'accepted' : 'rejected' } : item),
        paragraphs: comment?.suggestion && accepted
          ? state.paragraphs.map((paragraph) => paragraph.id === comment.paragraphId ? { ...paragraph, text: comment.suggestion as string, status: 'accepted' } : paragraph)
          : state.paragraphs,
      }
    }),
    mergeComment: (commentId, targetId) => record((state) => ({
      comments: state.comments.map((comment) => comment.id === commentId ? { ...comment, status: 'merged', mergedInto: targetId } : comment),
    })),
    createRuling: (input) => {
      const state = get()
      const paragraph = state.paragraphs.find((item) => item.id === input.paragraphId)
      if (!paragraph) return { ok: false, reason: 'missing' }
      if (paragraph.status === 'locked') return { ok: false, reason: 'locked' }
      if (state.conflicts.some((item) => item.paragraphId === input.paragraphId)) return { ok: false, reason: 'conflict' }
      const commentIds = input.commentIds.filter((commentId) => state.comments.some((item) => item.id === commentId && item.type === 'suggestion' && item.status === 'open'))
      if (commentIds.length < 2) return { ok: false, reason: 'no-conflict' }
      const mergedText = input.mergedText?.trim()
      if (!mergedText && (!input.winnerCommentId || !commentIds.includes(input.winnerCommentId))) return { ok: false, reason: 'empty' }
      if (!input.rationale.trim()) return { ok: false, reason: 'rationale' }
      record((current) => ({
        rulings: [{
          id: id('ruling'),
          paragraphId: input.paragraphId,
          commentIds,
          winnerCommentId: mergedText ? undefined : input.winnerCommentId,
          mergedText: mergedText || undefined,
          rationale: input.rationale.trim(),
          status: 'active' as const,
          fingerprint: rulingFingerprint(input.paragraphId, current.paragraphs, current.comments),
          createdAt: Date.now(),
        }, ...current.rulings.map((ruling) => ruling.paragraphId === input.paragraphId && ruling.status === 'active' ? { ...ruling, status: 'stale' as const } : ruling)],
      }))
      return { ok: true }
    },
    resolveRuling: (rulingId, accepted) => {
      const state = get()
      const ruling = state.rulings.find((item) => item.id === rulingId)
      if (!ruling || ruling.status !== 'active') return { ok: false, reason: 'inactive' }
      const paragraph = state.paragraphs.find((item) => item.id === ruling.paragraphId)
      if (paragraph?.status === 'locked') return { ok: false, reason: 'locked' }
      if (state.conflicts.some((item) => item.paragraphId === ruling.paragraphId)) return { ok: false, reason: 'conflict' }
      record((current) => {
        const recommended = ruling.mergedText ?? current.comments.find((item) => item.id === ruling.winnerCommentId)?.suggestion
        return {
          rulings: current.rulings.map((item) => item.id === rulingId ? { ...item, status: 'resolved' as const, resolution: accepted ? 'accepted' as const : 'rejected' as const, resolvedAt: Date.now() } : item),
          paragraphs: accepted && recommended
            ? current.paragraphs.map((item) => item.id === ruling.paragraphId ? { ...item, text: recommended, status: 'accepted' as const, highlighted: true } : item)
            : current.paragraphs,
          comments: accepted && ruling.winnerCommentId
            ? current.comments.map((item) => item.id === ruling.winnerCommentId ? { ...item, status: 'accepted' as const } : item)
            : current.comments,
        }
      })
      return { ok: true }
    },
    toggleLock: (paragraphId) => record((state) => ({
      paragraphs: state.paragraphs.map((paragraph) => paragraph.id === paragraphId ? {
        ...paragraph,
        status: paragraph.status === 'locked' ? 'accepted' : 'locked',
      } : paragraph),
    })),
    createVersion: (label) => record((state) => ({
      versions: [{ id: id('version'), label: label.trim() || `版本 ${state.versions.length + 1}`, createdAt: Date.now(), paragraphs: clone(state.paragraphs) }, ...state.versions],
    })),
    addConflict: (conflict) => set((state) => ({ conflicts: [conflict, ...state.conflicts] })),
    resolveConflict: (conflictId, strategy) => record((state) => {
      const conflict = state.conflicts.find((item) => item.id === conflictId)
      return {
        paragraphs: conflict && strategy === 'remote'
          ? state.paragraphs.map((paragraph) => paragraph.id === conflict.paragraphId ? { ...paragraph, text: conflict.remoteText, highlighted: true } : paragraph)
          : state.paragraphs,
        conflicts: state.conflicts.filter((item) => item.id !== conflictId),
      }
    }),
    dismissConflict: (conflictId) => set((state) => ({ conflicts: state.conflicts.filter((item) => item.id !== conflictId) })),
    undo: () => set((state) => {
      const previous = state.past.at(-1)
      if (!previous) return state
      const current: HistorySnapshot = { paragraphs: clone(state.paragraphs), comments: clone(state.comments), versions: clone(state.versions), rulings: clone(state.rulings) }
      const rulings = refreshRulings(previous.rulings, previous.paragraphs, previous.comments)
      persistDraft(previous.paragraphs, previous.comments, previous.versions, rulings)
      return { ...previous, rulings, past: state.past.slice(0, -1), future: [current, ...state.future], dirty: true }
    }),
    redo: () => set((state) => {
      const next = state.future[0]
      if (!next) return state
      const current: HistorySnapshot = { paragraphs: clone(state.paragraphs), comments: clone(state.comments), versions: clone(state.versions), rulings: clone(state.rulings) }
      const rulings = refreshRulings(next.rulings, next.paragraphs, next.comments)
      persistDraft(next.paragraphs, next.comments, next.versions, rulings)
      return { ...next, rulings, past: [...state.past, current], future: state.future.slice(1), dirty: true }
    }),
    save: () => {
      persistDraft(get().paragraphs, get().comments, get().versions, get().rulings)
      set({ dirty: false })
    },
    resetDemo: () => {
      localStorage.removeItem(DRAFT_KEY)
      set({ paragraphs: clone(baseParagraphs), comments: clone(baseComments), versions: clone(initialVersions), rulings: [], conflicts: [], past: [], future: [], dirty: false })
      persistDraft(baseParagraphs, baseComments, initialVersions, [])
    },
  }
})

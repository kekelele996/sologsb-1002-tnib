import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftOutlined, ArrowRightOutlined, AuditOutlined, BranchesOutlined, CheckOutlined, CloseOutlined,
  CommentOutlined, DiffOutlined, DeleteOutlined, FileDoneOutlined, FileTextOutlined,
  HistoryOutlined, LockOutlined, MenuFoldOutlined, MessageOutlined, PlusOutlined,
  RedoOutlined, SaveOutlined, SendOutlined, SwapOutlined, UndoOutlined, UnlockOutlined, UserSwitchOutlined,
} from '@ant-design/icons'
import { Alert, Badge, Button, Card, Checkbox, Divider, Empty, Input, Modal, Radio, Segmented, Select, Space, Tag, Tooltip, message } from 'antd'
import { submitRemotePatch } from './services/mockApi'
import { useReviewStore } from './store/review'
import type { Comment, CommentType, Paragraph, Role, Ruling } from './types'

const roleMeta: Record<Role, { label: string; description: string; color: string }> = {
  author: { label: '作者工作区', description: '编辑正文，按编辑裁决处理冲突建议，逐条接受或拒绝其余建议', color: '#2f6f5e' },
  reviewer: { label: '审稿人工作区', description: '引用原文、添加批注与修改建议并参与讨论', color: '#9a5b25' },
  editor: { label: '编辑工作区', description: '仲裁冲突建议、合并重复意见、锁定已确认段落并比较版本', color: '#5b4d8e' },
}
const roleIcon = (role: Role) => role === 'author' ? <FileDoneOutlined /> : role === 'reviewer' ? <CommentOutlined /> : <BranchesOutlined />
const formatDate = (value: number) => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
const rulingReasonText = (reason?: string) => ({
  locked: '段落已锁定，裁决不能生效',
  conflict: '该段落存在未处理的远端冲突，裁决不能生效',
  rationale: '请填写裁决理由',
  empty: '请选择一条胜出建议，或填写合并后的推荐正文',
  inactive: '该裁决已失效或已被处理',
  'no-conflict': '同段落至少需要两条待处理的修改建议才能仲裁',
  missing: '段落不存在',
}[reason ?? ''] ?? '操作失败')

export default function App() {
  const {
    role, paragraphs, comments, versions, rulings, selectedParagraphId, commentFilter, revisionMode, dirty, conflicts,
    setRole, selectParagraph, setCommentFilter, setRevisionMode, updateParagraph, addComment, replyComment,
    resolveSuggestion, mergeComment, createRuling, resolveRuling, toggleLock, createVersion, addConflict, resolveConflict, dismissConflict,
    undo, redo, save, resetDemo,
  } = useReviewStore()
  const [composerOpen, setComposerOpen] = useState(false)
  const [commentType, setCommentType] = useState<CommentType>('comment')
  const [commentBody, setCommentBody] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [quote, setQuote] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [versionOpen, setVersionOpen] = useState(false)
  const [versionA, setVersionA] = useState(versions[1]?.id ?? versions[0]?.id)
  const [versionB, setVersionB] = useState(versions[0]?.id)
  const [versionLabel, setVersionLabel] = useState('')
  const [rulingOpen, setRulingOpen] = useState(false)
  const [rulingChoice, setRulingChoice] = useState('')
  const [rulingMerged, setRulingMerged] = useState('')
  const [rulingRationale, setRulingRationale] = useState('')

  const selected = paragraphs.find((paragraph) => paragraph.id === selectedParagraphId) ?? paragraphs[0]
  const sections = useMemo(() => Array.from(new Set(paragraphs.map((paragraph) => paragraph.section))), [paragraphs])
  const paragraphCommentCounts = useMemo(() => comments.reduce<Record<string, number>>((acc, comment) => {
    acc[comment.paragraphId] = (acc[comment.paragraphId] ?? 0) + 1
    return acc
  }, {}), [comments])
  const duplicateParagraphIds = useMemo(() => new Set(Object.entries(paragraphCommentCounts).filter(([, count]) => count > 1).map(([id]) => id)), [paragraphCommentCounts])
  const visibleComments = useMemo(() => comments.filter((comment) => {
    if (commentFilter === 'open') return comment.status === 'open'
    if (commentFilter === 'suggestion') return comment.type === 'suggestion' && comment.status === 'open'
    if (commentFilter === 'duplicate') return duplicateParagraphIds.has(comment.paragraphId) && comment.status === 'open'
    return true
  }).sort((a, b) => b.createdAt - a.createdAt), [commentFilter, comments, duplicateParagraphIds])
  const openSuggestionsByParagraph = useMemo(() => {
    const map = new Map<string, Comment[]>()
    comments.forEach((comment) => {
      if (comment.type === 'suggestion' && comment.status === 'open') map.set(comment.paragraphId, [...(map.get(comment.paragraphId) ?? []), comment])
    })
    return map
  }, [comments])
  const activeRuledCommentIds = useMemo(() => new Set(rulings.filter((ruling) => ruling.status === 'active').flatMap((ruling) => ruling.commentIds)), [rulings])
  const commentRulingMeta = useMemo(() => {
    const map = new Map<string, { ruling: Ruling; isWinner: boolean }>()
    rulings.forEach((ruling) => {
      if (ruling.status === 'stale') return
      ruling.commentIds.forEach((commentId) => {
        const existing = map.get(commentId)
        if (!existing || ruling.status === 'active') map.set(commentId, { ruling, isWinner: !ruling.mergedText && ruling.winnerCommentId === commentId })
      })
    })
    return map
  }, [rulings])
  const sortedRulings = useMemo(() => [...rulings].sort((a, b) => {
    const weight = (ruling: Ruling) => ruling.status === 'active' ? 0 : ruling.status === 'stale' ? 1 : 2
    return weight(a) - weight(b) || b.createdAt - a.createdAt
  }), [rulings])
  const staleRulingCount = rulings.filter((ruling) => ruling.status === 'stale').length
  const rulingBlockedReason = (ruling: Ruling) => {
    if (paragraphs.find((paragraph) => paragraph.id === ruling.paragraphId)?.status === 'locked') return '段落已锁定，裁决暂不能生效'
    if (conflicts.some((conflict) => conflict.paragraphId === ruling.paragraphId)) return '该段落存在未处理的远端冲突，裁决暂不能生效'
    return null
  }

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return
      const state = useReviewStore.getState()
      const index = state.paragraphs.findIndex((paragraph) => paragraph.id === state.selectedParagraphId)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.shiftKey ? state.redo() : state.undo()
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault(); state.redo()
      } else if (event.key.toLowerCase() === 'j') {
        event.preventDefault(); const next = state.paragraphs[Math.min(state.paragraphs.length - 1, index + 1)]; if (next) state.selectParagraph(next.id)
      } else if (event.key.toLowerCase() === 'k') {
        event.preventDefault(); const previous = state.paragraphs[Math.max(0, index - 1)]; if (previous) state.selectParagraph(previous.id)
      } else if (event.key.toLowerCase() === 't') {
        event.preventDefault(); state.setRevisionMode(!state.revisionMode)
      } else if (event.key.toLowerCase() === 'l' && state.role === 'editor') {
        event.preventDefault(); state.toggleLock(state.selectedParagraphId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const scrollToParagraph = (id: string) => {
    selectParagraph(id)
    document.getElementById(`paragraph-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const openComposer = (type: CommentType) => {
    const selectedText = window.getSelection()?.toString().trim()
    setQuote(selectedText && selected?.text.includes(selectedText) ? selectedText : selected?.text.slice(0, 64) ?? '')
    setSuggestion(type === 'suggestion' ? selected?.text ?? '' : '')
    setCommentType(type)
    setComposerOpen(true)
  }
  const submitComment = () => {
    if (!selected || !commentBody.trim()) { message.warning('请填写批注内容'); return }
    addComment({ paragraphId: selected.id, type: commentType, quote, body: commentBody.trim(), suggestion: commentType === 'suggestion' ? suggestion : undefined })
    setCommentBody(''); setSuggestion(''); setQuote(''); setComposerOpen(false)
    message.success(commentType === 'suggestion' ? '修改建议已提交' : '段落批注已添加')
  }
  const handleMockConflict = async () => {
    if (!selected) return
    const response = await submitRemotePatch(selected)
    addConflict({
      id: `conflict-${Date.now()}`, paragraphId: selected.id, localText: selected.text, remoteText: response.remoteText,
      localAuthor: roleMeta[role].label, remoteAuthor: response.remoteAuthor, detectedAt: Date.now(),
    })
    message.warning('模拟接口返回了同段落的远端修改，请处理冲突')
  }
  const handleCreateVersion = () => {
    if (versionLabel.trim()) createVersion(versionLabel.trim())
    else createVersion('')
    setVersionLabel('')
    message.success('当前版本已保存')
  }
  const openArbitration = (paragraphId: string, prefill?: Ruling) => {
    selectParagraph(paragraphId)
    const suggestions = openSuggestionsByParagraph.get(paragraphId) ?? []
    setRulingChoice(prefill ? (prefill.mergedText ? '__merge__' : prefill.winnerCommentId ?? '') : suggestions[0]?.id ?? '')
    setRulingMerged(prefill?.mergedText ?? '')
    setRulingRationale(prefill?.rationale ?? '')
    setRulingOpen(true)
  }
  const submitRuling = () => {
    if (!selected) return
    const merge = rulingChoice === '__merge__'
    const result = createRuling({
      paragraphId: selected.id,
      commentIds: (openSuggestionsByParagraph.get(selected.id) ?? []).map((comment) => comment.id),
      winnerCommentId: merge ? undefined : rulingChoice || undefined,
      mergedText: merge ? rulingMerged : undefined,
      rationale: rulingRationale,
    })
    if (!result.ok) { message.warning(rulingReasonText(result.reason)); return }
    setRulingOpen(false); setRulingChoice(''); setRulingMerged(''); setRulingRationale('')
    message.success('裁决已发布，作者将按推荐正文处理，其余意见保留为少数意见')
  }
  const handleResolveRuling = (rulingId: string, accepted: boolean) => {
    const result = resolveRuling(rulingId, accepted)
    if (!result.ok) { message.warning(rulingReasonText(result.reason)); return }
    message.success(accepted ? '已采纳裁决推荐正文' : '已标记不采纳，原建议恢复逐条处理')
  }
  const arbitrationSuggestions = selected ? openSuggestionsByParagraph.get(selected.id) ?? [] : []
  const comparedA = versions.find((version) => version.id === versionA)
  const comparedB = versions.find((version) => version.id === versionB)
  const comparedRows = comparedA && comparedB ? comparedA.paragraphs.map((paragraph, index) => ({ a: paragraph, b: comparedB.paragraphs[index] })) : []

  return (
    <div className="review-app">
      <header className="app-header">
        <div className="paper-identity">
          <div className="paper-mark">CR</div>
          <div><h1>学术论文协作审阅台</h1><p>Collaborative Research Review · MS-2026-0417</p></div>
        </div>
        <div className="role-switch">
          <Segmented block value={role} onChange={(value) => setRole(value as Role)} options={(Object.keys(roleMeta) as Role[]).map((item) => ({ label: <span>{roleIcon(item)} {roleMeta[item].label.replace('工作区', '')}</span>, value: item }))} />
        </div>
        <Space>
          <Badge dot={dirty}><Button icon={<SaveOutlined />} onClick={() => { save(); message.success('草稿已保存到浏览器') }}>保存</Button></Badge>
          <Button icon={<UndoOutlined />} disabled={!useReviewStore.getState().past.length} onClick={undo} />
          <Button icon={<RedoOutlined />} disabled={!useReviewStore.getState().future.length} onClick={redo} />
          <Button danger={conflicts.length > 0} icon={<SwapOutlined />} onClick={() => void handleMockConflict()}>模拟冲突</Button>
        </Space>
      </header>

      <div className="role-banner" style={{ '--role-color': roleMeta[role].color } as React.CSSProperties}>
        <span className="role-badge">{roleIcon(role)} {roleMeta[role].label}</span>
        <span>{roleMeta[role].description}</span>
        <span className="paper-state"><FileTextOutlined /> 论文正文 v2.4</span>
      </div>

      {conflicts.length > 0 && (
        <div className="conflict-stack">
          {conflicts.map((conflict) => (
            <Alert
              key={conflict.id} type="error" showIcon message={`段落冲突：${conflict.localAuthor} 与 ${conflict.remoteAuthor} 同时修改`}
              description={(
                <div className="conflict-content">
                  <div><b>本页版本</b><p>{conflict.localText}</p></div>
                  <div><b>模拟远端版本</b><p>{conflict.remoteText}</p></div>
                  <Space><Button size="small" onClick={() => resolveConflict(conflict.id, 'local')}>保留本页</Button><Button size="small" type="primary" onClick={() => resolveConflict(conflict.id, 'remote')}>采用远端</Button><Button size="small" type="text" onClick={() => dismissConflict(conflict.id)}>稍后处理</Button></Space>
                </div>
              )}
            />
          ))}
        </div>
      )}

      <main className="workspace">
        <aside className="toc-panel">
          <div className="panel-title"><MenuFoldOutlined /> 侧边目录</div>
          <nav>
            {sections.map((section) => (
              <div key={section} className="toc-section">
                <strong>{section}</strong>
                {paragraphs.filter((paragraph) => paragraph.section === section).map((paragraph) => (
                  <button key={paragraph.id} className={paragraph.id === selected?.id ? 'active' : ''} onClick={() => scrollToParagraph(paragraph.id)}>
                    <span>{paragraph.number}</span>
                    <span>{paragraph.text.slice(0, 24)}…</span>
                    {paragraph.status === 'locked' && <LockOutlined />}
                    {!!paragraphCommentCounts[paragraph.id] && <Badge count={paragraphCommentCounts[paragraph.id]} size="small" />}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="version-box">
            <div className="panel-title"><HistoryOutlined /> 版本</div>
            <Input value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder="新版本名称" onPressEnter={handleCreateVersion} />
            <Button block icon={<PlusOutlined />} onClick={handleCreateVersion}>保存当前版本</Button>
            <Button block icon={<DiffOutlined />} onClick={() => setVersionOpen(true)}>比较两个版本</Button>
          </div>
        </aside>

        <section className="document-panel">
          <div className="document-toolbar">
            <div><h2>大语言模型辅助下的开源维护协作研究</h2><p>作者：林晓、陈默、王远 · 最近保存 {formatDate(Date.now())}</p></div>
            <Space>
              <Checkbox checked={revisionMode} onChange={(event) => setRevisionMode(event.target.checked)}>修订模式</Checkbox>
              <Tag color={dirty ? 'gold' : 'green'}>{dirty ? '有未保存修改' : '已保存'}</Tag>
            </Space>
          </div>

          <div className="paper-sheet">
            <div className="paper-kicker">RESEARCH ARTICLE · CONFIDENTIAL REVIEW</div>
            {sections.map((section) => (
              <section key={section} className="paper-section">
                <h3>{section}</h3>
                {paragraphs.filter((paragraph) => paragraph.section === section).map((paragraph) => (
                  <article
                    id={`paragraph-${paragraph.id}`} key={paragraph.id} onMouseUp={() => setQuote(window.getSelection()?.toString().trim() ?? '')}
                    className={`paragraph-card ${paragraph.id === selected?.id ? 'selected' : ''} ${paragraph.highlighted ? 'highlighted' : ''} ${paragraph.status === 'locked' ? 'locked' : ''}`}
                    onClick={() => selectParagraph(paragraph.id)}
                  >
                    <div className="paragraph-meta">
                      <span className="paragraph-no">{paragraph.number}</span>
                      <span>段落 {paragraph.number.replace('.', '')}</span>
                      {paragraph.status === 'locked' && <Tag icon={<LockOutlined />} color="purple">已锁定</Tag>}
                      {paragraph.status === 'accepted' && <Tag icon={<CheckOutlined />} color="green">已确认</Tag>}
                      {!!paragraphCommentCounts[paragraph.id] && <Tag icon={<MessageOutlined />}>{paragraphCommentCounts[paragraph.id]} 条意见</Tag>}
                    </div>
                    {revisionMode ? (
                      <div className="revision-grid">
                        <div><small>原稿</small><p>{paragraph.original}</p></div>
                        <div><small>当前修订</small><p>{paragraph.text}</p></div>
                      </div>
                    ) : role === 'author' ? (
                      <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} value={paragraph.text} readOnly={paragraph.status === 'locked'} onChange={(event) => updateParagraph(paragraph.id, event.target.value)} />
                    ) : (
                      <p className="paragraph-text">{paragraph.text}</p>
                    )}
                    <div className="paragraph-actions">
                      {role === 'reviewer' && <><Button size="small" icon={<CommentOutlined />} onClick={(event) => { event.stopPropagation(); selectParagraph(paragraph.id); openComposer('comment') }}>添加批注</Button><Button size="small" icon={<FileDoneOutlined />} onClick={(event) => { event.stopPropagation(); selectParagraph(paragraph.id); openComposer('suggestion') }}>提出建议</Button></>}
                      {role === 'editor' && <Button size="small" icon={paragraph.status === 'locked' ? <UnlockOutlined /> : <LockOutlined />} onClick={(event) => { event.stopPropagation(); toggleLock(paragraph.id) }}>{paragraph.status === 'locked' ? '解除锁定' : '锁定段落'}</Button>}
                      {role === 'editor' && (openSuggestionsByParagraph.get(paragraph.id)?.length ?? 0) >= 2 && (() => {
                        const blockedTip = paragraph.status === 'locked' ? '段落已锁定，不能发布裁决' : conflicts.some((conflict) => conflict.paragraphId === paragraph.id) ? '存在未处理的远端冲突，不能发布裁决' : ''
                        const button = <Button size="small" type="primary" ghost icon={<AuditOutlined />} disabled={!!blockedTip} onClick={(event) => { event.stopPropagation(); openArbitration(paragraph.id) }}>仲裁冲突建议</Button>
                        return blockedTip ? <Tooltip title={blockedTip}>{button}</Tooltip> : button
                      })()}
                      {role === 'author' && <span className="author-tip">可直接修改正文，右侧逐条处理建议</span>}
                    </div>
                  </article>
                ))}
              </section>
            ))}
          </div>
        </section>

        <aside className="comments-panel">
          <div className="comments-header">
            <div><h2><CommentOutlined /> 审阅意见 <Badge count={comments.filter((comment) => comment.status === 'open').length} /></h2><p>引用原文、讨论与修订建议</p></div>
          </div>
          <div className="comment-filters">
            <Radio.Group value={commentFilter} onChange={(event) => setCommentFilter(event.target.value)} buttonStyle="solid" size="small">
              <Radio.Button value="all">全部</Radio.Button><Radio.Button value="open">待处理</Radio.Button><Radio.Button value="suggestion">建议</Radio.Button><Radio.Button value="duplicate">重复</Radio.Button>
            </Radio.Group>
          </div>
          {staleRulingCount > 0 && <Alert className="ruling-alert" type="warning" showIcon message={`${staleRulingCount} 项裁决因正文、建议内容或引用范围变化已失效${role === 'editor' ? '，请重新仲裁' : '，等待编辑重新仲裁'}`} />}
          {sortedRulings.length > 0 && (
            <div className="ruling-list">
              {sortedRulings.map((ruling) => {
                const paragraph = paragraphs.find((item) => item.id === ruling.paragraphId)
                const winner = comments.find((item) => item.id === ruling.winnerCommentId)
                const recommended = ruling.mergedText ?? winner?.suggestion
                const blocked = ruling.status === 'active' ? rulingBlockedReason(ruling) : null
                const minorityCount = ruling.commentIds.filter((commentId) => !!ruling.mergedText || commentId !== ruling.winnerCommentId).length
                return (
                  <div key={ruling.id} className={`ruling-card ${ruling.status}`}>
                    <div className="ruling-head">
                      <button className="ruling-title" onClick={() => paragraph && scrollToParagraph(paragraph.id)}><AuditOutlined /> 编辑裁决 · 段落 {paragraph?.number}</button>
                      {ruling.status === 'active' && <Tag color="gold">当前有效裁决</Tag>}
                      {ruling.status === 'stale' && <Tag color="red">已失效 · 待重新仲裁</Tag>}
                      {ruling.status === 'resolved' && <Tag color={ruling.resolution === 'accepted' ? 'green' : 'default'}>{ruling.resolution === 'accepted' ? '已采纳' : '未采纳'}</Tag>}
                    </div>
                    {recommended && <div className="ruling-text"><small>推荐正文{ruling.mergedText ? '（编辑合并）' : ` · 采纳 ${winner?.author ?? ''}`}</small><p>{recommended}</p></div>}
                    <p className="ruling-rationale">裁决理由：{ruling.rationale}</p>
                    <p className="ruling-minority">其余 {minorityCount} 条原意见保留为少数意见 · {formatDate(ruling.createdAt)}</p>
                    {ruling.status === 'stale' && <Alert type="warning" showIcon message="正文、建议内容或引用范围已变化，原裁决不再适用" />}
                    {blocked && <Alert type="info" showIcon message={blocked} />}
                    {ruling.status === 'active' && role === 'author' && (
                      <div className="ruling-actions">
                        <Button type="primary" size="small" icon={<CheckOutlined />} disabled={!!blocked} onClick={() => handleResolveRuling(ruling.id, true)}>采纳推荐正文</Button>
                        <Button danger size="small" disabled={!!blocked} onClick={() => handleResolveRuling(ruling.id, false)}>不采纳</Button>
                      </div>
                    )}
                    {ruling.status === 'active' && role !== 'author' && <p className="ruling-waiting">等待作者按当前有效裁决处理</p>}
                    {role === 'editor' && ruling.status !== 'resolved' && (
                      <div className="ruling-actions">
                        <Button size="small" icon={<AuditOutlined />} onClick={() => openArbitration(ruling.paragraphId, ruling)}>重新仲裁</Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <div className="comment-list">
            {visibleComments.map((comment) => {
              const paragraph = paragraphs.find((item) => item.id === comment.paragraphId)
              return (
                <Card key={comment.id} size="small" className={`comment-card ${comment.status}`} title={<span>{comment.author} <Tag>{comment.type === 'suggestion' ? '修改建议' : '段落批注'}</Tag></span>} extra={<small>{formatDate(comment.createdAt)}</small>}>
                  <button className="quote-line" onClick={() => paragraph && scrollToParagraph(paragraph.id)}>“{comment.quote}” · 段落 {paragraph?.number}</button>
                  <p className="comment-body">{comment.body}</p>
                  {comment.suggestion && <div className="suggestion-box"><small>建议改为</small><p>{comment.suggestion}</p></div>}
                  {comment.status !== 'open' && <Tag color={comment.status === 'accepted' ? 'green' : comment.status === 'rejected' ? 'red' : 'blue'}>{comment.status === 'accepted' ? '已接受' : comment.status === 'rejected' ? '已拒绝' : '已合并'}</Tag>}
                  {commentRulingMeta.get(comment.id) && <Tag color={commentRulingMeta.get(comment.id)?.isWinner ? 'gold' : 'blue'}>{commentRulingMeta.get(comment.id)?.isWinner ? '裁决推荐' : '少数意见'}</Tag>}
                  <div className="replies">
                    {comment.replies.map((reply) => <div key={reply.id} className="reply"><b>{reply.author}</b><span>{reply.body}</span></div>)}
                  </div>
                  <div className="reply-box">
                    <Input size="small" value={replyDrafts[comment.id] ?? ''} onChange={(event) => setReplyDrafts((drafts) => ({ ...drafts, [comment.id]: event.target.value }))} placeholder="回复讨论…" onPressEnter={() => { const body = replyDrafts[comment.id]?.trim(); if (body) { replyComment(comment.id, body); setReplyDrafts((drafts) => ({ ...drafts, [comment.id]: '' })) } }} />
                    <Button size="small" type="text" icon={<SendOutlined />} onClick={() => { const body = replyDrafts[comment.id]?.trim(); if (body) { replyComment(comment.id, body); setReplyDrafts((drafts) => ({ ...drafts, [comment.id]: '' })) } }} />
                  </div>
                  {comment.status === 'open' && role === 'author' && comment.type === 'suggestion' && (activeRuledCommentIds.has(comment.id)
                    ? <p className="ruled-tip">已纳入编辑裁决，请处理上方“当前有效裁决”卡片；本条将作为少数意见保留。</p>
                    : <div className="decision-row"><Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => resolveSuggestion(comment.id, true)}>接受修改</Button><Button danger size="small" icon={<CloseOutlined />} onClick={() => resolveSuggestion(comment.id, false)}>拒绝</Button></div>)}
                  {comment.status === 'open' && role === 'editor' && duplicateParagraphIds.has(comment.paragraphId) && (() => {
                    const sibling = comments.find((item) => item.id !== comment.id && item.paragraphId === comment.paragraphId && item.status === 'open')
                    return sibling ? <Button size="small" type="dashed" icon={<BranchesOutlined />} onClick={() => mergeComment(comment.id, sibling.id)}>合并到“{sibling.author}”意见</Button> : null
                  })()}
                </Card>
              )
            })}
            {!visibleComments.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选下没有意见" />}
          </div>
          <div className="keyboard-hint"><span><kbd>J</kbd>/<kbd>K</kbd> 段落导航</span><span><kbd>T</kbd> 修订模式</span>{role === 'editor' && <span><kbd>L</kbd> 锁定</span>}<span><kbd>⌘Z</kbd> 撤销</span></div>
        </aside>
      </main>

      <Modal title={commentType === 'suggestion' ? '提出修改建议' : '添加段落批注'} open={composerOpen} onCancel={() => setComposerOpen(false)} onOk={submitComment} okText="提交" width={620}>
        <div className="composer">
          <label>引用原文</label>
          <Input.TextArea value={quote} onChange={(event) => setQuote(event.target.value)} autoSize={{ minRows: 2, maxRows: 4 }} />
          <label>{commentType === 'suggestion' ? '建议改为' : '批注内容'}</label>
          {commentType === 'suggestion' && <Input.TextArea value={suggestion} onChange={(event) => setSuggestion(event.target.value)} autoSize={{ minRows: 3, maxRows: 7 }} />}
          <label>说明</label>
          <Input.TextArea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="说明修改理由或希望作者关注的问题" autoSize={{ minRows: 2, maxRows: 5 }} />
        </div>
      </Modal>

      <Modal title="仲裁冲突建议" open={rulingOpen} onCancel={() => setRulingOpen(false)} onOk={submitRuling} okText="发布裁决" width={640}>
        {selected && (
          <div className="composer">
            <Alert type="info" showIcon message={`段落 ${selected.number} 有 ${arbitrationSuggestions.length} 条互相冲突的修改建议。发布后作者只能按当前有效裁决处理，其余原意见保留为少数意见；正文、建议或引用再变化时裁决将自动失效。`} />
            <label>裁决方式</label>
            <Radio.Group className="arbitration-options" value={rulingChoice} onChange={(event) => setRulingChoice(event.target.value as string)}>
              {arbitrationSuggestions.map((comment) => (
                <Radio key={comment.id} value={comment.id}>
                  <span className="arbitration-option-text"><b>{comment.author}</b>：{comment.suggestion}</span>
                </Radio>
              ))}
              <Radio value="__merge__"><span className="arbitration-option-text">给出合并后的推荐正文</span></Radio>
            </Radio.Group>
            {rulingChoice === '__merge__' && (
              <>
                <label>合并后的推荐正文</label>
                <Input.TextArea value={rulingMerged} onChange={(event) => setRulingMerged(event.target.value)} placeholder="综合多条建议，给出作者应采用的最终正文" autoSize={{ minRows: 3, maxRows: 7 }} />
              </>
            )}
            <label>裁决理由（必填）</label>
            <Input.TextArea value={rulingRationale} onChange={(event) => setRulingRationale(event.target.value)} placeholder="说明为何选择该建议或如此合并，作者与审稿人均可见" autoSize={{ minRows: 2, maxRows: 4 }} />
          </div>
        )}
      </Modal>

      <Modal title="版本比较" open={versionOpen} onCancel={() => setVersionOpen(false)} footer={null} width={980}>
        <div className="compare-selectors">
          <Select value={versionA} onChange={setVersionA} options={versions.map((version) => ({ label: `${version.label} · ${formatDate(version.createdAt)}`, value: version.id }))} />
          <ArrowRightOutlined />
          <Select value={versionB} onChange={setVersionB} options={versions.map((version) => ({ label: `${version.label} · ${formatDate(version.createdAt)}`, value: version.id }))} />
        </div>
        <div className="version-table">
          <div className="version-head"><b>{comparedA?.label ?? '版本 A'}</b><b>{comparedB?.label ?? '版本 B'}</b></div>
          {comparedRows.map(({ a, b }) => (
            <div key={a.id} className={`version-row ${a.text !== b?.text ? 'changed' : ''}`}>
              <div><span>{a.number}</span>{a.text}</div><div><span>{b?.number ?? '—'}</span>{b?.text ?? '段落已删除'}</div>
            </div>
          ))}
        </div>
      </Modal>

      <footer className="app-footer">
        <span>本地草稿自动持久化 · 模拟接口用于演示多人修改后的冲突处理</span>
        <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => { resetDemo(); message.success('已重置示例数据') }}>重置示例</Button>
      </footer>
    </div>
  )
}

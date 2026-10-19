import { useEffect, useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { getActions, approveAction, rejectAction } from '../services/api'

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

const FX_CSS = `
@keyframes ac-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
.ac-rise { animation: ac-rise .5s cubic-bezier(.2,.8,.2,1) both }
.ac-seg-ind { transition: transform .35s cubic-bezier(.2,.8,.2,1), width .35s cubic-bezier(.2,.8,.2,1) }
@media (prefers-reduced-motion: reduce) { .ac-rise { animation: none !important } .ac-seg-ind { transition: none } }
`

// Helper to format time cleanly
const FT = iso => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso || '—')
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Soft light-theme pill styles
const INTENT_THEME = {
  schedule: 'text-sky-700 bg-sky-50 ring-sky-200/70',
  escalate: 'text-rose-700 bg-rose-50 ring-rose-200/70',
  status: 'text-amber-700 bg-amber-50 ring-amber-200/70',
  general: 'text-zinc-600 bg-[#f5f5f7] ring-black/[0.05]',
}

const STATUS_META = {
  pending: { label: 'Pending Review', cls: 'text-amber-700 bg-amber-50 ring-amber-200/70', tone: 'text-amber-700' },
  sent: { label: 'Sent', cls: 'text-emerald-700 bg-emerald-50 ring-emerald-200/70', tone: 'text-emerald-700' },
  approved: { label: 'Sent', cls: 'text-emerald-700 bg-emerald-50 ring-emerald-200/70', tone: 'text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'text-red-700 bg-red-50 ring-red-200/70', tone: 'text-red-700' },
  escalated: { label: 'Escalated', cls: 'text-rose-700 bg-rose-50 ring-rose-200/70', tone: 'text-rose-700' },
  escalation: { label: 'Escalated', cls: 'text-rose-700 bg-rose-50 ring-rose-200/70', tone: 'text-rose-700' },
  pending_escalation: { label: 'Flagged (Review)', cls: 'text-amber-700 bg-amber-50 ring-amber-200/70', tone: 'text-amber-700' },
}

const ESCALATED_STATUSES = ['escalated', 'escalation']

function ActionRow({ action, globalIdx, onUpdate }) {
  const { toast, dispatch } = useApp() || {}
  const [expanded, setExpanded] = useState(false)
  const [approving, setApproving] = useState(false)
  const [dismissing, setDismissing] = useState(null)
  const draftRef = useRef(null)

  const a = action
  const isSent = ['sent', 'approved'].includes(a.status)
  const isEscalated = ESCALATED_STATUSES.includes(a.status)
  const isFlagged = a.status === 'pending_escalation'
  const canReview = ['pending', 'escalated', 'pending_escalation'].includes(a.status)
  const sm = STATUS_META[a.status] || STATUS_META.pending
  const intTheme = INTENT_THEME[a.intent] || INTENT_THEME.general
  const confidence = a.agent_state?.confidence ?? a.confidence
  const escalationReason = a.agent_state?.escalation_reason || a.escalation_reason
  const hasCalendar = !!(a.calendar_event && (a.calendar_event.start || a.calendar_event.id || a.calendar_event.title))

  const handleApprove = async (e) => {
    e.stopPropagation()
    setApproving(true)
    try {
      const body = draftRef.current?.innerText || a.draft_body || ''
      const r = await approveAction(a.id, { body, subject: a.draft_subject })
      if (r.error) { toast?.(r.error, 'warn'); setApproving(false); return }
      dispatch?.({ type: 'UPDATE_ACTION_STATUS', id: a.id, status: r.status || 'sent' })
      toast?.('Action approved & sent!', 'ok')
      setDismissing('approve')
      setTimeout(() => onUpdate?.(), 320)
    } catch { toast?.('Approve failed', 'warn'); setApproving(false) }
  }

  const handleReject = async (e) => {
    e.stopPropagation()
    try {
      await rejectAction(a.id)
      dispatch?.({ type: 'UPDATE_ACTION_STATUS', id: a.id, status: 'rejected' })
      toast?.('Rejected', 'warn')
      setDismissing('reject')
      setTimeout(() => onUpdate?.(), 320)
    } catch {}
  }

  return (
    <div
      className={`relative border-b border-black/[0.06] last:border-b-0 group transition-colors duration-200 ${expanded ? 'bg-[#fafafc]' : 'hover:bg-[#f5f5f7]'}`}
      style={{
        opacity: dismissing ? 0 : 1,
        transform: dismissing === 'approve' ? 'translateY(-10px)' : dismissing === 'reject' ? 'translateX(16px)' : 'none',
        transition: dismissing ? 'all 0.32s ease' : undefined,
      }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Escalation left-edge indicator */}
      {(isEscalated || isFlagged) && (
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${isEscalated ? 'bg-gradient-to-b from-rose-400 to-rose-600' : 'bg-gradient-to-b from-amber-300 to-amber-500'}`} />
      )}

      <div className="flex items-start gap-4 p-5 cursor-pointer">
        <div className="pt-1 w-6 shrink-0 text-[13px] font-semibold tabular-nums text-zinc-400">
          {String(globalIdx + 1).padStart(2, '0')}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <span className="text-[17px] font-semibold text-zinc-900 tracking-tight leading-none">
              {(a.email?.sender || 'Unknown').split('@')[0]}
            </span>

            <span className={`text-[11px] font-medium capitalize px-2.5 py-0.5 rounded-full ring-1 ${intTheme}`}>
              {a.intent || 'general'}
            </span>

            {typeof confidence === 'number' && (
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-zinc-600 ring-1 ring-black/[0.05]">
                Confidence {Math.round(confidence * 100)}%
              </span>
            )}

            <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ring-1 ml-auto ${sm.cls}`}>
              {sm.label}
            </span>
          </div>

          <div className="text-[14px] text-zinc-500 truncate mb-1">
            {a.email?.subject || '—'}
          </div>

          {(isEscalated || isFlagged) && escalationReason && (
            <div className="text-[12px] text-rose-600 mb-1 font-medium">
              {escalationReason}
            </div>
          )}

          {a.draft_body && !expanded && (
            <p className="text-[14px] text-zinc-400 line-clamp-2 leading-relaxed mt-1">
              {a.draft_body}
            </p>
          )}

          {!expanded && !isSent && a.draft_body && (
            <div className="text-[12px] text-[#0071e3] mt-2 font-medium transition-transform duration-200 group-hover:translate-x-1">
              Click to review draft →
            </div>
          )}
        </div>
      </div>

      {/* Expanded Section */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: expanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.35s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          {expanded && (
            <div className="pl-14 pr-5 pb-6" onClick={e => e.stopPropagation()}>

              <div className="grid md:grid-cols-2 gap-6 mt-2">
                {/* Original Message */}
                <div>
                  <div className="text-[12px] font-semibold text-zinc-500 mb-2">Original message</div>
                  <div className="text-[14px] leading-relaxed text-zinc-700 bg-white ring-1 ring-black/[0.06] p-4 rounded-2xl max-h-[250px] overflow-y-auto whitespace-pre-wrap shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                    {a.email?.body || a.email?.snippet || '(no body)'}
                  </div>
                </div>

                {/* AI Draft */}
                {a.draft_body && !isSent && canReview && (
                  <div>
                    <div className="text-[12px] font-semibold text-[#0071e3] mb-2 flex items-center justify-between">
                      <span>AI draft</span>
                      <span className="text-zinc-400 font-medium">Editable</span>
                    </div>
                    <div
                      ref={draftRef}
                      contentEditable={a.status === 'pending' ? 'true' : 'false'}
                      suppressContentEditableWarning
                      className="text-[14px] leading-relaxed text-zinc-900 bg-white ring-1 ring-black/[0.08] p-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#0071e3] focus:shadow-[0_0_0_6px_rgba(0,113,227,0.12)] transition-all shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
                    >
                      {a.draft_body}
                    </div>
                  </div>
                )}

                {/* Status read-only block */}
                {(isSent || isEscalated || isFlagged) && (
                  <div>
                    <div className="text-[12px] font-semibold text-zinc-500 mb-2">Status</div>
                    <div className={`text-[14px] leading-relaxed bg-white ring-1 ring-black/[0.06] p-4 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] ${sm.tone}`}>
                      {isEscalated
                        ? '▲ This action was escalated to the human queue for manual review.'
                        : isFlagged
                          ? '▲ Low confidence — flagged for manual review. Approve or reject below.'
                          : '✓ Action has been sent successfully.'}
                    </div>
                  </div>
                )}
              </div>

              {/* Calendar */}
              {hasCalendar && (
                <div className="mt-4 px-4 py-3 rounded-2xl bg-teal-50 ring-1 ring-teal-200/70 text-[14px] flex items-center gap-2">
                  <span className="text-teal-700 font-semibold">Scheduled:</span>{' '}
                  <span className="text-zinc-800 font-medium">{a.calendar_event.title}</span>
                  <span className="text-zinc-500 text-[12px] ml-auto">{FT(a.calendar_event.start)}</span>
                </div>
              )}

              {a.calendar_error && (
                <div className="mt-3 px-4 py-3 rounded-2xl bg-amber-50 ring-1 ring-amber-200/70 text-[12px] text-amber-800">
                  Calendar error: {a.calendar_error}
                </div>
              )}

              {/* Action buttons */}
              {canReview && (
                <div className="flex items-center gap-3 mt-6 flex-wrap pt-4 border-t border-black/[0.06]">
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="rounded-full px-6 py-2.5 text-[14px] font-medium text-white shadow-[0_4px_14px_rgba(0,113,227,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,113,227,0.45)] active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
                    style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }}
                  >
                    {approving ? 'Processing...' : 'Approve & Send'}
                  </button>
                  <button
                    onClick={handleReject}
                    className="ml-auto rounded-full bg-red-50 px-5 py-2.5 text-[14px] font-medium text-red-600 ring-1 ring-red-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-100 active:scale-95"
                  >
                    Reject
                  </button>
                </div>
              )}

              {isEscalated && (
                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-black/[0.06]">
                  <a
                    href="https://mail.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-white px-5 py-2.5 text-[14px] font-medium text-zinc-800 ring-1 ring-black/[0.1] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.10)] active:scale-95"
                  >
                    Open in Gmail ↗
                  </a>
                </div>
              )}

              <div className="text-[11px] text-zinc-400 mt-4 flex items-center justify-between">
                <span>Created {FT(a.created_at)}</span>
                <span>Priority score: {a.urgency || 0}/100</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const FILTERS = [
  { id: 'all', label: 'All Actions' },
  { id: 'pending', label: 'Pending' },
  { id: 'sent', label: 'Sent' },
  { id: 'rejected', label: 'Rejected' }
]

export default function Actions() {
  const { state, dispatch } = useApp() || {}
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [rev, setRev] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const d = await getActions()
      dispatch?.({ type: 'SET_ACTIONS', actions: d.actions || [] })
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const actions = state?.actions || []
  const filtered = filter === 'all' ? actions
    : filter === 'pending' ? actions.filter(a => a.status?.includes('pending'))
    : filter === 'sent' ? actions.filter(a => ['sent', 'approved'].includes(a.status))
    : actions.filter(a => a.status === 'rejected')

  const sorted = [...filtered].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

  const filterIdx = Math.max(0, FILTERS.findIndex(f => f.id === filter))

  return (
    <div className="pb-24 text-zinc-900" style={{ fontFamily: FONT }}>
      <style>{FX_CSS}</style>

      {/* HEADER */}
      <div className="ac-rise mb-8 border-b border-black/[0.07] pb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="mb-3 text-[13px] font-semibold text-[#0071e3]">Activity / History</div>
            <h1
              className="bg-clip-text text-[clamp(36px,6vw,60px)] font-semibold leading-[1.02] tracking-tight text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #4a4a58 100%)' }}
            >
              Agent Actions
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter segmented control */}
            <div className="relative grid grid-cols-4 rounded-2xl bg-[#f5f5f7] p-1 ring-1 ring-black/[0.05]" role="tablist" aria-label="Filter actions">
              <span
                className="ac-seg-ind absolute top-1 bottom-1 left-1 rounded-xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.12)]"
                style={{ width: 'calc((100% - 8px) / 4)', transform: `translateX(${filterIdx * 100}%)` }}
              />
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`relative z-10 whitespace-nowrap rounded-xl px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer ${filter === f.id ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-zinc-700 ring-1 ring-black/[0.08] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.10)] active:scale-95 disabled:opacity-50"
              aria-label="Refresh Data"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* ACTION FEED */}
      <div className="ac-rise bg-white ring-1 ring-black/[0.06] rounded-3xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.07)]" style={{ animationDelay: '100ms' }}>
        {sorted.length > 0 ? (
          <div className="flex flex-col">
            {sorted.map((a, i) => (
              <ActionRow
                key={a.id}
                action={a}
                globalIdx={i}
                onUpdate={() => setRev(r => r + 1)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-28 px-4 gap-2 bg-[#fafafc]">
            <div className="text-[18px] font-semibold text-zinc-800">
              {loading ? 'Fetching actions...' : `No ${filter === 'all' ? '' : filter + ' '}actions found`}
            </div>
            <div className="text-[14px] text-zinc-400">
              {loading ? 'Loading the latest agent activity' : 'Agent activity will show up here'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
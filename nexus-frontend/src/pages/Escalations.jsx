import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { getActions } from '../services/api'

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

const FX_CSS = `
@keyframes es-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
@keyframes es-grow { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes es-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(244,63,94,0) } 50% { box-shadow: 0 0 0 6px rgba(244,63,94,.12) } }
.es-rise { animation: es-rise .55s cubic-bezier(.2,.8,.2,1) both }
.es-grow { transform-origin: left; animation: es-grow .9s .2s cubic-bezier(.2,.8,.2,1) both }
.es-pulse { animation: es-pulse 2.4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .es-rise, .es-grow, .es-pulse { animation: none !important } }
`

const FT = iso => {
  try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso || '' }
}

function EscalationRow({ action, idx, onResolve }) {
  const [expanded, setExpanded] = useState(false)

  const a = action
  const urgencyColor = a.urgency >= 80 ? '#f43f5e' : a.urgency >= 50 ? '#f59e0b' : '#10b981'
  const confidence = a.agent_state?.confidence ?? a.confidence
  const escalationReason = a.agent_state?.escalation_reason || a.escalation_reason

  return (
    <div
      className={`es-rise relative cursor-pointer overflow-hidden rounded-3xl bg-white ring-1 transition-all duration-300 ${expanded ? 'ring-rose-200 shadow-[0_18px_50px_rgba(244,63,94,0.12)]' : 'ring-black/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.09)]'}`}
      style={{ animationDelay: `${idx * 70}ms` }}
      onClick={() => setExpanded(e => !e)}
    >
      <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-rose-400 to-rose-600" />

      <div className="flex gap-5 p-6 pl-7">
        <div className="pt-0.5 text-[15px] font-semibold tabular-nums text-rose-400">{String(idx + 1).padStart(2, '0')}</div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-3">
            <span className="text-[18px] font-semibold tracking-tight text-zinc-900">
              {(a.email?.sender || 'Unknown').split('@')[0]}
            </span>
            <span className="es-pulse rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200/70">
              Escalated
            </span>
            {typeof confidence === 'number' && (
              <span className="rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-black/[0.04]">
                Confidence {Math.round(confidence * 100)}%
              </span>
            )}
            <span className="ml-auto text-[12px] text-zinc-400">{FT(a.created_at)}</span>
          </div>

          <div className="mb-1 truncate text-[13px] text-zinc-500">{a.email?.subject || '—'}</div>

          {escalationReason && (
            <div className="text-[12px] font-medium text-rose-600">{escalationReason}</div>
          )}

          {/* Urgency bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="text-[11px] font-medium text-zinc-400">Urgency</div>
            <div className="h-1.5 max-w-[160px] flex-1 overflow-hidden rounded-full bg-black/[0.07]">
              <div
                className="es-grow h-full rounded-full"
                style={{ width: `${a.urgency || 0}%`, background: urgencyColor }}
              />
            </div>
            <span className="text-[12px] font-semibold tabular-nums" style={{ color: urgencyColor }}>{a.urgency || 0}/100</span>
          </div>

          {/* Expanded */}
          <div
            style={{
              display: 'grid',
              gridTemplateRows: expanded ? '1fr' : '0fr',
              transition: 'grid-template-rows 0.35s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              {expanded && (
                <div className="mt-5 border-t border-black/[0.07] pt-5" onClick={e => e.stopPropagation()}>
                  <div className="mb-4 rounded-2xl bg-rose-50/70 p-4 ring-1 ring-rose-100">
                    <div className="mb-1 text-[12px] font-semibold text-rose-700">Escalation reason</div>
                    <p className="text-[14px] leading-[1.65] text-zinc-700">
                      {a.summary || `Urgency score ${a.urgency}/100 exceeded your escalation threshold. LangGraph has routed this for manual review.`}
                    </p>
                  </div>

                  {a.email?.body && (
                    <div className="mb-5">
                      <div className="mb-2 text-[12px] font-semibold text-zinc-500">Original message</div>
                      <div className="max-h-[200px] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-[#f5f5f7] p-4 text-[14px] leading-[1.65] text-zinc-700 ring-1 ring-black/[0.04]">
                        {a.email.body}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href="https://mail.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full px-5 py-2.5 text-[13px] font-medium text-white shadow-[0_4px_14px_rgba(0,113,227,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,113,227,0.45)] active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }}
                      onClick={e => e.stopPropagation()}
                    >
                      Open Gmail
                    </a>
                    <button
                      onClick={e => { e.stopPropagation(); onResolve(a.id) }}
                      className="rounded-full bg-emerald-50 px-5 py-2.5 text-[13px] font-medium text-emerald-700 ring-1 ring-emerald-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-100 active:scale-95"
                    >
                      Mark resolved
                    </button>
                    {escalationReason && (
                      <div className="text-[12px] text-zinc-500">Explain: {escalationReason}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Escalations() {
  const { state, dispatch, toast } = useApp() || {}
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await getActions()
      dispatch?.({ type: 'SET_ACTIONS', actions: d.actions || [] })
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const escalations = (state?.actions || []).filter(a => a.status === 'escalated')

  const handleResolve = (id) => {
    dispatch?.({ type: 'UPDATE_ACTION_STATUS', id, status: 'resolved' })
    toast?.('Escalation resolved', 'ok')
  }

  return (
    <div className="pb-20 text-zinc-900" style={{ fontFamily: FONT }}>
      <style>{FX_CSS}</style>

      {/* HEADER */}
      <div className="es-rise mb-10 border-b border-black/[0.07] pb-8">
        <div className="mb-3 text-[13px] font-semibold text-[#0071e3]">Review / Human queue</div>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <h1
            className="bg-clip-text text-[clamp(36px,6vw,60px)] font-semibold leading-[1.02] tracking-tight text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #4a4a58 100%)' }}
          >
            Escalations
          </h1>
          {escalations.length > 0 && (
            <div className="es-pulse w-fit rounded-full bg-rose-50 px-4 py-2 text-[13px] font-semibold text-rose-700 ring-1 ring-rose-200/70">
              {escalations.length} pending review
            </div>
          )}
        </div>
      </div>

      {escalations.length > 0 ? (
        <div className="flex flex-col gap-4">
          {escalations.map((a, i) => (
            <EscalationRow
              key={a.id}
              action={a}
              idx={i}
              onResolve={handleResolve}
            />
          ))}
        </div>
      ) : (
        <div className="es-rise flex flex-col items-center justify-center gap-2 rounded-3xl bg-[#f5f5f7] py-24 ring-1 ring-black/[0.04]">
          <div className="text-[18px] font-semibold text-zinc-800">
            {loading ? 'Checking queue...' : 'All clear'}
          </div>
          <div className="text-[14px] text-zinc-500">
            {loading ? 'Looking for escalated tickets' : 'No escalations right now'}
          </div>
        </div>
      )}
    </div>
  )
}
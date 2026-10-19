import { useEffect, useState } from 'react'
import { getTickets } from '../services/api'
import { useApp } from '../context/AppContext'

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

const FX_CSS = `
@keyframes cal-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
@keyframes cal-draw { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes cal-ping { 0% { box-shadow: 0 0 0 0 rgba(0,113,227,.4) } 100% { box-shadow: 0 0 0 10px rgba(0,113,227,0) } }
.cal-rise { animation: cal-rise .55s cubic-bezier(.2,.8,.2,1) both }
.cal-line { transform-origin: left; animation: cal-draw .8s cubic-bezier(.2,.8,.2,1) both }
.cal-dot { animation: cal-ping 2.2s ease-out infinite }
@media (prefers-reduced-motion: reduce) { .cal-rise, .cal-line, .cal-dot { animation: none !important } }
`

const formatDateTime = value => {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',  
    hour: 'numeric',
    minute: '2-digit',
  })
}

const ticketTitle = ticket => ticket.subject || ticket.content?.slice(0, 80) || 'Untitled ticket'

/* Time between raised and routed, e.g. "12 sec" or "3 min" */
const elapsed = (from, to) => {
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  if (!from || !to || Number.isNaN(a) || Number.isNaN(b) || b < a) return ''
  const s = Math.round((b - a) / 1000)
  if (s < 1) return 'instant'
  if (s < 60) return `${s} sec`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} hr`
  return `${Math.round(h / 24)} days`
}

export default function Calendar() {
  const { toast } = useApp() || {}
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getTickets()
      setTickets(response.tickets || [])
    } catch {
      setError('Unable to load ticket timeline. Check that the routing backend is running.')
      toast?.('Ticket timeline unavailable', 'warn')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="pb-24 text-zinc-900" style={{ fontFamily: FONT }}>
      <style>{FX_CSS}</style>

      <header className="cal-rise mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-black/[0.07] pb-8">
        <div>
          <div className="mb-3 text-[13px] font-semibold text-[#0071e3]">Ticket timeline</div>
          <h1
            className="bg-clip-text text-[clamp(36px,6vw,60px)] font-semibold leading-[1.02] tracking-tight text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #4a4a58 100%)' }}
          >
            Raised to routed
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-zinc-500">
            A chronological view of when customers raised tickets and when the routing agent assigned them to a specialist queue.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-zinc-700 ring-1 ring-black/[0.08] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.10)] active:scale-95 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh timeline'}
        </button>
      </header>

      {error && (
        <div className="cal-rise mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          {error}
        </div>
      )}

      <section className="cal-rise rounded-3xl bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.06]" style={{ animationDelay: '90ms' }}>
        {loading && !tickets.length ? (
          <div className="py-20 text-center text-[13px] text-zinc-400">Loading ticket timeline…</div>
        ) : tickets.length ? (
          <div className="space-y-1">
            {tickets.map((ticket, i) => {
              const raisedAt = ticket.created_at
              const routedAt = ticket.routed_at || ticket.updated_at || ticket.created_at
              const took = elapsed(raisedAt, routedAt)
              return (
                <article
                  key={ticket.id}
                  className="cal-rise group relative -mx-3 grid gap-5 rounded-2xl border-b border-black/[0.06] px-3 py-6 transition-colors duration-200 last:border-0 hover:bg-[#f5f5f7] md:grid-cols-[minmax(200px,1fr)_minmax(110px,160px)_minmax(260px,1.2fr)] md:items-center"
                  style={{ animationDelay: `${160 + Math.min(i, 10) * 60}ms` }}
                >
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Ticket raised</div>
                    <div className="mt-2 text-[14px] font-semibold text-zinc-900">{formatDateTime(raisedAt)}</div>
                  </div>

                  {/* connector with elapsed time */}
                  <div className="hidden flex-col items-center gap-2 md:flex">
                    <span className="rounded-full bg-[#0071e3]/[0.08] px-2.5 py-0.5 text-[11px] font-semibold text-[#0071e3]">{took || 'routed'}</span>
                    <div className="relative flex w-full items-center">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#3aa0ff] ring-4 ring-blue-50" />
                      <span
                        className="cal-line mx-1 h-[2px] flex-1 rounded-full"
                        style={{ background: 'linear-gradient(90deg, #3aa0ff, #10b981)', animationDelay: `${260 + Math.min(i, 10) * 60}ms` }}
                      />
                      <span className="cal-dot h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Agent routed</div>
                    <div className="mt-2 text-[14px] font-semibold text-zinc-900">{formatDateTime(routedAt)}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-zinc-500">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 transition-colors group-hover:bg-white">{ticketTitle(ticket)}</span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{ticket.specialist_queue || 'unassigned'}</span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="py-20 text-center text-[13px] text-zinc-400">No tickets have been raised yet.</div>
        )}
      </section>
    </div>
  )
}
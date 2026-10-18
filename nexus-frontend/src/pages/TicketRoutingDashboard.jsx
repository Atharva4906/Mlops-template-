import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRoutingMetrics, getTickets } from '../services/api'

const cards = [
  { key: 'total_tickets', label: 'Routed tickets', color: 'text-sky-600', glow: 'hover:shadow-[0_14px_36px_rgba(14,165,233,0.18)]' },
  { key: 'open_tickets', label: 'Open queue', color: 'text-amber-600', glow: 'hover:shadow-[0_14px_36px_rgba(245,158,11,0.18)]' },
  { key: 'urgent_tickets', label: 'Urgent tickets', color: 'text-rose-600', glow: 'hover:shadow-[0_14px_36px_rgba(244,63,94,0.18)]' },
  { key: 'reassigned_tickets', label: 'Agent corrections', color: 'text-emerald-600', glow: 'hover:shadow-[0_14px_36px_rgba(16,185,129,0.18)]' },
]

const FX_CSS = `
@keyframes trd-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
.trd-rise { animation: trd-rise .6s cubic-bezier(.2,.8,.2,1) both }
@media (prefers-reduced-motion: reduce) { .trd-rise { animation: none !important } }
`

export default function TicketRoutingDashboard() {
  const [tickets, setTickets] = useState([])
  const [metrics, setMetrics] = useState({})
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [ticketResponse, metricResponse] = await Promise.all([getTickets(), getRoutingMetrics()])
      setTickets(ticketResponse.tickets || [])
      const values = ticketResponse.tickets || []
      setMetrics({
        ...metricResponse,
        open_tickets: values.filter(ticket => ticket.status === 'open').length,
        urgent_tickets: values.filter(ticket => ticket.sentiment === 'urgent').length,
        reassigned_tickets: values.filter(ticket => ticket.was_reassigned).length,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div
      className="pb-24 text-zinc-900"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif' }}
    >
      <style>{FX_CSS}</style>

      {/* Header */}
      <div className="trd-rise mb-10 flex flex-col gap-5 border-b border-black/[0.07] pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 text-[13px] font-semibold text-[#0071e3]">Ticket routing command center</div>
          <h1
            className="text-[clamp(36px,6vw,60px)] font-semibold leading-[1.02] tracking-tight bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #4a4a58 100%)' }}
          >
            Route every request
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-6 text-zinc-500">
            Email and multi-channel messages are sanitized, classified, and delivered to the right specialist queue.
          </p>
        </div>
        <button
          onClick={load}
          className="self-start md:self-auto px-5 py-2.5 rounded-full bg-white ring-1 ring-black/[0.08] shadow-sm text-[13px] font-medium text-zinc-700 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.10)] active:scale-95 transition-all duration-200 cursor-pointer"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ key, label, color, glow }, i) => (
          <div
            key={key}
            className={`trd-rise rounded-3xl bg-[#f5f5f7] ring-1 ring-black/[0.04] p-6 transition-all duration-200 hover:-translate-y-1 hover:bg-white ${glow}`}
            style={{ animationDelay: `${80 + i * 70}ms` }}
          >
            <div className={`text-[13px] font-semibold ${color}`}>{label}</div>
            <div className="mt-3 text-[44px] font-semibold leading-none tracking-tight text-zinc-900">{metrics[key] || 0}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="trd-rise mb-8 flex flex-wrap gap-3" style={{ animationDelay: '360ms' }}>
        <Link
          to="/ticket-simulator"
          className="px-6 py-3 rounded-full text-[14px] font-medium text-white shadow-[0_6px_18px_rgba(0,113,227,0.35)] hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(0,113,227,0.45)] active:scale-95 transition-all duration-200"
          style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }}
        >
          Submit test ticket
        </Link>
        <Link
          to="/inbox"
          className="px-6 py-3 rounded-full bg-white ring-1 ring-black/[0.08] shadow-sm text-[14px] font-medium text-zinc-700 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.10)] active:scale-95 transition-all duration-200"
        >
          Open specialist queue
        </Link>
      </div>

      {/* Latest tickets */}
      <section className="trd-rise rounded-3xl bg-white ring-1 ring-black/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.06)] overflow-hidden" style={{ animationDelay: '440ms' }}>
        <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4 bg-[#fafafc]">
          <div className="text-[15px] font-semibold text-zinc-900">Latest routed tickets</div>
          <Link to="/inbox" className="text-[13px] font-medium text-[#0071e3] hover:underline">View queue</Link>
        </div>
        {tickets.length ? tickets.slice(0, 8).map(ticket => (
          <div
            key={ticket.id}
            className="flex flex-col gap-2 border-b border-black/[0.05] px-6 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between transition-colors duration-150 hover:bg-[#f5f5f7]"
          >
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium text-zinc-900">{ticket.subject || 'Untitled support request'}</div>
              <div className="mt-1 text-[12px] text-zinc-500">{ticket.channel} · {ticket.specialist_queue} · {ticket.intent}</div>
            </div>
            <span className="shrink-0 self-start sm:self-auto rounded-full bg-[#f5f5f7] px-3 py-1 text-[12px] font-medium text-zinc-600 capitalize">
              {ticket.status?.replace('_', ' ')}
            </span>
          </div>
        )) : <div className="px-6 py-12 text-center text-[14px] text-zinc-500">No tickets routed yet. Submit a test ticket or ingest an email to begin.</div>}
      </section>
    </div>
  )
}
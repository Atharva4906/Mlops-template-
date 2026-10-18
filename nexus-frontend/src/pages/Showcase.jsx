import { useEffect, useState } from 'react'
import { getTicketDomains, getTickets } from '../services/api'

const FX_CSS = `
@keyframes sc-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
.sc-rise { animation: sc-rise .6s cubic-bezier(.2,.8,.2,1) both }
@media (prefers-reduced-motion: reduce) { .sc-rise { animation: none !important } }
`

export default function Showcase() {
  const [tickets, setTickets] = useState([])
  const [domains, setDomains] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [ticketResponse, domainResponse] = await Promise.all([getTickets(), getTicketDomains()])
      setTickets(ticketResponse.tickets || [])
      setDomains(domainResponse.domains || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const stats = [
    { label: 'Routed tickets', value: tickets.length, color: 'text-zinc-900', glow: 'hover:shadow-[0_14px_36px_rgba(0,0,0,0.10)]' },
    { label: 'Active domains', value: domains.length, color: 'text-sky-600', glow: 'hover:shadow-[0_14px_36px_rgba(14,165,233,0.18)]' },
    { label: 'Open', value: tickets.filter(ticket => ticket.status === 'open').length, color: 'text-amber-600', glow: 'hover:shadow-[0_14px_36px_rgba(245,158,11,0.18)]' },
    { label: 'Urgent', value: tickets.filter(ticket => ticket.sentiment === 'urgent').length, color: 'text-rose-600', glow: 'hover:shadow-[0_14px_36px_rgba(244,63,94,0.18)]' },
  ]

  return (
    <div
      className="pb-24 text-zinc-900"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif' }}
    >
      <style>{FX_CSS}</style>

      {/* Header */}
      <div className="sc-rise mb-10 flex flex-col gap-5 border-b border-black/[0.07] pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 text-[13px] font-semibold text-[#0071e3]">Ingestion showcase</div>
          <h1
            className="text-[clamp(36px,6vw,60px)] font-semibold leading-[1.02] tracking-tight bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #4a4a58 100%)' }}
          >
            Showcasing
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-6 text-zinc-500">
            See how incoming communications are scrubbed, understood, and delivered into ticket domains.
          </p>
        </div>
        <button
          onClick={load}
          className="self-start md:self-auto px-5 py-2.5 rounded-full bg-white ring-1 ring-black/[0.08] shadow-sm text-[13px] font-medium text-zinc-700 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.10)] active:scale-95 transition-all duration-200"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, color, glow }, i) => (
          <div
            key={label}
            className={`sc-rise rounded-3xl bg-[#f5f5f7] ring-1 ring-black/[0.04] p-6 transition-all duration-200 hover:-translate-y-1 hover:bg-white ${glow}`}
            style={{ animationDelay: `${80 + i * 70}ms` }}
          >
            <div className="text-[13px] font-semibold text-zinc-500">{label}</div>
            <div className={`mt-3 text-[44px] font-semibold leading-none tracking-tight ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Recent routing */}
      <div className="sc-rise rounded-3xl bg-white ring-1 ring-black/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.06)] overflow-hidden" style={{ animationDelay: '380ms' }}>
        <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4 bg-[#fafafc]">
          <div className="text-[15px] font-semibold text-zinc-900">Recent routing</div>
          <a href="#/inbox" className="text-[13px] font-medium text-[#0071e3] hover:underline">Open queue</a>
        </div>
        {tickets.length ? tickets.slice(0, 8).map(ticket => (
          <div
            key={ticket.id}
            className="flex flex-col gap-2 border-b border-black/[0.05] px-6 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between transition-colors duration-150 hover:bg-[#f5f5f7]"
          >
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium text-zinc-900">{ticket.subject || 'Untitled support request'}</div>
              <div className="mt-1 text-[12px] text-zinc-500">{ticket.channel} · {ticket.domain_name || ticket.domain} · {ticket.specialist_queue}</div>
            </div>
            <span className="shrink-0 self-start sm:self-auto rounded-full bg-[#f5f5f7] px-3 py-1 text-[12px] font-medium text-zinc-600 capitalize">
              {ticket.status?.replace('_', ' ')}
            </span>
          </div>
        )) : <div className="px-6 py-12 text-center text-[14px] text-zinc-500">No routed tickets yet. Ingest an email or chat to see the result here.</div>}
      </div>
    </div>
  )
}
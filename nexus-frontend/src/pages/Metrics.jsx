import { useEffect, useState } from 'react'
import { getRoutingMetrics, getTickets } from '../services/api'
import { useApp } from '../context/AppContext'

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

const FX_CSS = `
@keyframes mt-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
@keyframes mt-grow { from { transform: scaleX(0) } to { transform: scaleX(1) } }
.mt-rise { animation: mt-rise .55s cubic-bezier(.2,.8,.2,1) both }
.mt-grow { transform-origin: left; animation: mt-grow 1s .3s cubic-bezier(.2,.8,.2,1) both }
@media (prefers-reduced-motion: reduce) { .mt-rise, .mt-grow { animation: none !important } }
`

const cardStyle = 'rounded-3xl bg-white p-6 ring-1 ring-black/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.06)]'

const ACCENTS = {
  sky: { text: 'text-sky-600', glow: 'hover:shadow-[0_14px_36px_rgba(14,165,233,0.18)]' },
  violet: { text: 'text-violet-600', glow: 'hover:shadow-[0_14px_36px_rgba(139,92,246,0.18)]' },
  emerald: { text: 'text-emerald-600', glow: 'hover:shadow-[0_14px_36px_rgba(16,185,129,0.18)]' },
  amber: { text: 'text-amber-600', glow: 'hover:shadow-[0_14px_36px_rgba(245,158,11,0.18)]' },
}

/* Counts up to a number; non-numbers are shown as-is */
function CountUp({ to }) {
  const target = Number(to)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!isFinite(target)) return
    let raf, start
    const dur = 1000
    const tick = t => {
      if (!start) start = t
      const p = Math.min((t - start) / dur, 1)
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return <>{isFinite(target) ? n : to}</>
}

function MetricCard({ label, value, detail, accent = 'sky', delay = 0 }) {
  const c = ACCENTS[accent] || ACCENTS.sky
  return (
    <div
      className={`mt-rise rounded-3xl bg-[#f5f5f7] p-6 ring-1 ring-black/[0.04] transition-all duration-300 hover:-translate-y-1 hover:bg-white ${c.glow}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`text-[12px] font-semibold uppercase tracking-wider ${c.text}`}>{label}</div>
      <div className="mt-4 text-[40px] font-semibold leading-none tracking-tight text-zinc-900"><CountUp to={value} /></div>
      <div className="mt-3 text-[12px] leading-5 text-zinc-500">{detail}</div>
    </div>
  )
}

function Bar({ pct, from = '#3aa0ff', to = '#0071e3' }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#f0f0f2]">
      <div className="mt-grow h-2 rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${from}, ${to})` }} />
    </div>
  )
}

export default function Metrics() {
  const { toast } = useApp() || {}
  const [routing, setRouting] = useState({})
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [routingData, ticketData] = await Promise.all([getRoutingMetrics(), getTickets()])
      setRouting(routingData || {})
      setTickets(ticketData?.tickets || [])
    } catch {
      toast?.('Ticket-routing metrics unavailable', 'warn')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const byQueue = routing.by_queue || {}
  const byIntent = routing.by_intent || {}
  const byChannel = tickets.reduce((counts, ticket) => {
    const channel = ticket.channel || 'unknown'
    counts[channel] = (counts[channel] || 0) + 1
    return counts
  }, {})
  const byStatus = tickets.reduce((counts, ticket) => {
    const status = ticket.status || 'unknown'
    counts[status] = (counts[status] || 0) + 1
    return counts
  }, {})

  const total = Math.max(routing.total_tickets || tickets.length || 1, 1)
  const share = count => Math.min(100, (count / total) * 100)

  return (
    <div className="pb-24 text-zinc-900" style={{ fontFamily: FONT }}>
      <style>{FX_CSS}</style>

      <div className="mt-rise mb-10 flex flex-col gap-5 border-b border-black/[0.07] pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 text-[13px] font-semibold text-[#0071e3]">Ticket routing observability</div>
          <h1
            className="bg-clip-text text-[clamp(36px,6vw,60px)] font-semibold leading-[1.02] tracking-tight text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #4a4a58 100%)' }}
          >
            Routing metrics
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-6 text-zinc-500">
            Monitor ticket volume, queue distribution, routing quality, latency, drift, and model health.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="self-start rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-zinc-700 ring-1 ring-black/[0.08] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.10)] active:scale-95 disabled:opacity-50 md:self-auto"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total tickets" value={routing.total_tickets ?? tickets.length} detail="Tickets received by the routing system" accent="sky" delay={60} />
        <MetricCard label="Specialist queues" value={Object.keys(byQueue).length} detail="Queues currently handling tickets" accent="violet" delay={120} />
        <MetricCard label="Active intents" value={Object.keys(byIntent).length} detail="Intent categories identified by routing" accent="emerald" delay={180} />
        <MetricCard label="Open tickets" value={byStatus.open || 0} detail="Tickets awaiting specialist resolution" accent="amber" delay={240} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${cardStyle} mt-rise`} style={{ animationDelay: '300ms' }}>
          <div className="mb-5 text-[16px] font-semibold">Queue distribution</div>
          <div className="space-y-4">
            {Object.entries(byQueue).length ? Object.entries(byQueue).map(([queue, count]) => (
              <div key={queue}>
                <div className="mb-1.5 flex justify-between text-[13px]"><span className="text-zinc-600">{queue}</span><strong className="tabular-nums">{count}</strong></div>
                <Bar pct={Math.min(100, (count / Math.max(routing.total_tickets || 1, 1)) * 100)} />
              </div>
            )) : <p className="text-[13px] text-zinc-400">No routed tickets yet.</p>}
          </div>
        </section>

        <section className={`${cardStyle} mt-rise`} style={{ animationDelay: '360ms' }}>
          <div className="mb-5 text-[16px] font-semibold">Intent distribution</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(byIntent).length ? Object.entries(byIntent).map(([intent, count]) => (
              <div key={intent} className="rounded-2xl bg-[#f5f5f7] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_22px_rgba(0,0,0,0.08)]">
                <div className="text-[12px] capitalize text-zinc-500">{intent}</div>
                <div className="mt-1 text-[25px] font-semibold tabular-nums">{count}</div>
                <div className="mt-2"><Bar pct={share(count)} from="#34d399" to="#059669" /></div>
              </div>
            )) : <p className="text-[13px] text-zinc-400">No intent data yet.</p>}
          </div>
        </section>

        <section className={`${cardStyle} mt-rise`} style={{ animationDelay: '420ms' }}>
          <div className="mb-5 text-[16px] font-semibold">Channel distribution</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(byChannel).length ? Object.entries(byChannel).map(([channel, count]) => (
              <div key={channel} className="rounded-2xl bg-[#f5f5f7] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_22px_rgba(0,0,0,0.08)]">
                <div className="text-[12px] capitalize text-zinc-500">{channel}</div>
                <div className="mt-1 text-[25px] font-semibold tabular-nums">{count}</div>
                <div className="mt-2"><Bar pct={share(count)} from="#a78bfa" to="#7c3aed" /></div>
              </div>
            )) : <p className="text-[13px] text-zinc-400">No channel data yet.</p>}
          </div>
        </section>

        <section className={`${cardStyle} mt-rise`} style={{ animationDelay: '480ms' }}>
          <div className="mb-5 text-[16px] font-semibold">Ticket status</div>
          <div className="space-y-4 text-[13px]">
            {Object.entries(byStatus).length ? Object.entries(byStatus).map(([status, count]) => (
              <div key={status}>
                <div className="mb-1.5 flex justify-between"><span className="capitalize text-zinc-500">{status.replace('_', ' ')}</span><strong className="tabular-nums">{count}</strong></div>
                <Bar pct={share(count)} from="#fbbf24" to="#f59e0b" />
              </div>
            )) : <p className="text-zinc-400">No ticket status data yet.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
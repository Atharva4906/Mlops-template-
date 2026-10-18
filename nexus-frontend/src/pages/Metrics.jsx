import { useEffect, useState } from 'react'
import { Activity, BarChart3, RefreshCw, Route, Server, Ticket, Users } from 'lucide-react'
import { getRoutingMetrics, getTickets } from '../services/api'
import { useApp } from '../context/AppContext'

const cardStyle = 'rounded-3xl bg-white p-6 ring-1 ring-black/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.06)]'

function MetricCard({ icon: Icon, label, value, detail }) {
  return (
    <div className={cardStyle}>
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
        <Icon size={15} className="text-[#0071e3]" /> {label}
      </div>
      <div className="mt-4 text-[38px] font-semibold tracking-tight text-zinc-900">{value}</div>
      <div className="mt-2 text-[12px] text-zinc-500">{detail}</div>
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

  return (
    <div className="min-h-screen pb-24 text-zinc-900">
      <div className="mb-10 flex flex-col gap-5 border-b border-black/[0.07] pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[#0071e3]">
            <Activity size={15} /> Ticket routing observability
          </div>
          <h1 className="text-[clamp(36px,6vw,60px)] font-semibold leading-none tracking-tight">Routing metrics</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-6 text-zinc-500">
            Monitor ticket volume, queue distribution, routing quality, latency, drift, and model health.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 self-start rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-zinc-700 ring-1 ring-black/[0.08] shadow-sm hover:-translate-y-0.5 disabled:opacity-50 md:self-auto">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Ticket} label="Total tickets" value={routing.total_tickets ?? tickets.length} detail="Tickets received by the routing system" />
        <MetricCard icon={Route} label="Specialist queues" value={Object.keys(byQueue).length} detail="Queues currently handling tickets" />
        <MetricCard icon={Users} label="Active intents" value={Object.keys(byIntent).length} detail="Intent categories identified by routing" />
        <MetricCard icon={BarChart3} label="Open tickets" value={byStatus.open || 0} detail="Tickets awaiting specialist resolution" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={cardStyle}>
          <div className="mb-5 flex items-center gap-2 text-[15px] font-semibold"><Server size={17} className="text-[#0071e3]" /> Queue distribution</div>
          <div className="space-y-4">
            {Object.entries(byQueue).length ? Object.entries(byQueue).map(([queue, count]) => (
              <div key={queue}>
                <div className="mb-1 flex justify-between text-[13px]"><span className="text-zinc-600">{queue}</span><strong>{count}</strong></div>
                <div className="h-2 rounded-full bg-[#f0f0f2]"><div className="h-2 rounded-full bg-gradient-to-r from-[#3aa0ff] to-[#0071e3]" style={{ width: `${Math.min(100, (count / Math.max(routing.total_tickets || 1, 1)) * 100)}%` }} /></div>
              </div>
            )) : <p className="text-[13px] text-zinc-400">No routed tickets yet.</p>}
          </div>
        </section>

        <section className={cardStyle}>
          <div className="mb-5 flex items-center gap-2 text-[15px] font-semibold"><BarChart3 size={17} className="text-emerald-600" /> Intent distribution</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(byIntent).length ? Object.entries(byIntent).map(([intent, count]) => (
              <div key={intent} className="rounded-2xl bg-[#f5f5f7] p-4"><div className="text-[12px] capitalize text-zinc-500">{intent}</div><div className="mt-1 text-[25px] font-semibold">{count}</div></div>
            )) : <p className="text-[13px] text-zinc-400">No intent data yet.</p>}
          </div>
        </section>

        <section className={cardStyle}>
          <div className="mb-5 text-[15px] font-semibold">Channel distribution</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(byChannel).length ? Object.entries(byChannel).map(([channel, count]) => (
              <div key={channel} className="rounded-2xl bg-[#f5f5f7] p-4"><div className="text-[12px] capitalize text-zinc-500">{channel}</div><div className="mt-1 text-[25px] font-semibold">{count}</div></div>
            )) : <p className="text-[13px] text-zinc-400">No channel data yet.</p>}
          </div>
        </section>

        <section className={cardStyle}>
          <div className="mb-5 text-[15px] font-semibold">Ticket status</div>
          <div className="space-y-4 text-[13px]">
            {Object.entries(byStatus).length ? Object.entries(byStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between"><span className="capitalize text-zinc-500">{status}</span><strong>{count}</strong></div>
            )) : <p className="text-zinc-400">No ticket status data yet.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}

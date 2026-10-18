import { useEffect, useState } from 'react'
import { RefreshCw, Route, Ticket, Clock3, AlertTriangle } from 'lucide-react'
import { getTickets } from '../services/api'
import { useApp } from '../context/AppContext'

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
    <div className="min-h-screen bg-[#f7f8fb] pb-24 text-zinc-900">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-black/[0.07] pb-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[#0071e3]">
            <Clock3 size={15} /> Ticket timeline
          </div>
          <h1 className="text-[clamp(34px,5vw,56px)] font-semibold leading-none tracking-tight">Raised to routed</h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-6 text-zinc-500">
            A chronological view of when customers raised tickets and when the routing agent assigned them to a specialist queue.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-zinc-700 ring-1 ring-black/[0.08] shadow-sm hover:-translate-y-0.5 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {loading ? 'Refreshing…' : 'Refresh timeline'}
        </button>
      </header>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <section className="rounded-3xl bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.06]">
        {loading && !tickets.length ? (
          <div className="py-20 text-center text-[13px] text-zinc-400">Loading ticket timeline…</div>
        ) : tickets.length ? (
          <div className="space-y-1">
            {tickets.map(ticket => {
              const raisedAt = ticket.created_at
              const routedAt = ticket.routed_at || ticket.updated_at || ticket.created_at
              return (
                <article key={ticket.id} className="relative grid gap-5 border-b border-black/[0.06] py-6 last:border-0 md:grid-cols-[minmax(220px,1fr)_32px_minmax(260px,1.2fr)] md:items-center">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"><Ticket size={14} /> Ticket raised</div>
                    <div className="mt-2 text-[14px] font-semibold text-zinc-900">{formatDateTime(raisedAt)}</div>
                  </div>
                  <div className="hidden justify-center md:flex"><span className="h-3 w-3 rounded-full bg-[#3aa0ff] ring-4 ring-blue-50" /></div>
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-600"><Route size={14} /> Agent routed</div>
                    <div className="mt-2 text-[14px] font-semibold text-zinc-900">{formatDateTime(routedAt)}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-zinc-500">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1">{ticketTitle(ticket)}</span>
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

import { useEffect, useState } from 'react'
import { createTicket, getEmails, getQueues, getTicketDomains, getTickets, reassignTicket, updateTicketStatus } from '../services/api'
import { useApp } from '../context/AppContext'

const tone = {
  fraud: 'text-rose-700 bg-rose-50 ring-1 ring-rose-200/70',
  billing: 'text-amber-700 bg-amber-50 ring-1 ring-amber-200/70',
  technical: 'text-sky-700 bg-sky-50 ring-1 ring-sky-200/70',
  account: 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200/70',
  general: 'text-zinc-600 bg-[#f5f5f7] ring-1 ring-black/[0.05]',
}

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

const FX_CSS = `
@keyframes tq-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
@keyframes tq-fade { from { opacity: 0; transform: translateX(8px) } to { opacity: 1; transform: none } }
.tq-rise { animation: tq-rise .6s cubic-bezier(.2,.8,.2,1) both }
.tq-fade { animation: tq-fade .35s cubic-bezier(.2,.8,.2,1) both }
@media (prefers-reduced-motion: reduce) { .tq-rise, .tq-fade { animation: none !important } }
`

const selectCls = 'rounded-full bg-white ring-1 ring-black/[0.08] shadow-sm px-4 py-2 text-[13px] font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-[#0071e3] transition-all cursor-pointer'

function TicketDetail({ ticket, queues, onStatusChange, onReassign }) {
  if (!ticket) {
    return <div className="flex min-h-[360px] items-center justify-center text-[14px] text-zinc-400">Select a ticket to inspect its routing decision.</div>
  }

  return (
    <div key={ticket.id} className="tq-fade p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center rounded-full bg-emerald-50 ring-1 ring-emerald-200/70 px-3 py-1 text-[12px] font-medium text-emerald-700">
            PII scrubbed before review
          </div>
          <h2 className="text-[22px] font-semibold tracking-tight text-zinc-900">{ticket.subject || 'Untitled support request'}</h2>
          <p className="mt-2 text-[12px] text-zinc-500">{ticket.channel} · {ticket.domain_name || ticket.domain || 'Unassigned domain'} · {ticket.specialist_queue}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <select value={ticket.status} onChange={event => onStatusChange(ticket.id, event.target.value)} className={selectCls}>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="escalated">Escalated</option>
          </select>
          <select value={ticket.specialist_queue} onChange={event => onReassign(ticket.id, event.target.value)} className={`${selectCls} !text-[#0071e3]`}>
            {queues.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-6 rounded-2xl bg-[#f5f5f7] ring-1 ring-black/[0.04] p-5 text-[14px] leading-7 text-zinc-800 whitespace-pre-wrap">
        {ticket.content}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`rounded-2xl p-4 ${tone[ticket.intent] || tone.general}`}>
          <div className="text-[12px] font-medium opacity-70">Intent</div>
          <div className="mt-1 text-[16px] font-semibold capitalize">{ticket.intent}</div>
        </div>
        <div className={`rounded-2xl p-4 ${ticket.sentiment === 'urgent' ? tone.fraud : tone.account}`}>
          <div className="text-[12px] font-medium opacity-70">Sentiment</div>
          <div className="mt-1 text-[16px] font-semibold capitalize">{ticket.sentiment}</div>
        </div>
        <div className="rounded-2xl bg-[#f5f5f7] ring-1 ring-black/[0.05] p-4 text-zinc-700">
          <div className="text-[12px] font-medium text-zinc-500">Confidence</div>
          <div className="mt-1 text-[16px] font-semibold text-zinc-900">{Math.round(ticket.confidence * 100)}%</div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 text-[13px] font-semibold text-zinc-900">Top routing signals</div>
        <div className="flex flex-wrap gap-2">
          {ticket.explanation?.length ? ticket.explanation.map(signal => (
            <span key={signal.token} className="rounded-full bg-[#0071e3]/[0.08] px-3 py-1 text-[12px] font-medium text-[#0071e3]">
              {signal.token} {signal.weight > 0 ? '+' : ''}{signal.weight.toFixed(2)}
            </span>
          )) : <span className="text-[12px] text-zinc-400">No explanation signals returned.</span>}
        </div>
      </div>
    </div>
  )
}

export default function TicketQueue() {
  const { state, dispatch, toast } = useApp()
  const [selectedId, setSelectedId] = useState(null)
  const [queue, setQueue] = useState('')
  const [loading, setLoading] = useState(false)
  const [queues, setQueues] = useState([])
  const [domains, setDomains] = useState([])
  const [domain, setDomain] = useState('')
  const [simulator, setSimulator] = useState({ channel: 'webhook', subject: '', content: '' })
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const filters = { ...(queue ? { specialist_queue: queue } : {}), ...(domain ? { domain } : {}) }
      await getEmails(10)
      const [ticketResponse, queueResponse, domainResponse] = await Promise.all([getTickets(filters), getQueues(), getTicketDomains()])
      dispatch({ type: 'SET_TICKETS', tickets: ticketResponse.tickets || [] })
      setQueues(queueResponse.queues || [])
      setDomains(domainResponse.domains || [])
      if (!selectedId && ticketResponse.tickets?.[0]) setSelectedId(ticketResponse.tickets[0].id)
    } catch {
      toast?.('Unable to load specialist queue', 'warn')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [queue, domain])

  const tickets = state?.tickets || []
  const selected = tickets.find(ticket => ticket.id === selectedId) || tickets[0]

  const handleStatusChange = async (id, status) => {
    try {
      const response = await updateTicketStatus(id, status)
      dispatch({ type: 'UPDATE_TICKET', ticket: response.ticket })
    } catch {
      toast?.('Status update failed', 'warn')
    }
  }

  const handleReassign = async (id, specialist_queue) => {
    try {
      const response = await reassignTicket(id, specialist_queue, 'Agent triage correction')
      dispatch({ type: 'UPDATE_TICKET', ticket: response.ticket })
      toast?.('Ticket reassigned and feedback recorded', 'ok')
    } catch {
      toast?.('Ticket reassignment failed', 'warn')
    }
  }

  const handleSubmit = async event => {
    event.preventDefault()
    if (!simulator.content.trim()) return
    setSubmitting(true)
    try {
      const response = await createTicket(simulator)
      dispatch({ type: 'PREPEND_TICKET', ticket: response.ticket })
      setSelectedId(response.ticket.id)
      setSimulator(current => ({ ...current, subject: '', content: '' }))
      toast?.('Ticket ingested and routed', 'ok')
    } catch {
      toast?.('Ticket submission failed', 'warn')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'rounded-full bg-white ring-1 ring-black/[0.08] shadow-sm px-5 py-3 text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-[#0071e3] focus:shadow-[0_0_0_6px_rgba(0,113,227,0.12)] transition-all duration-200'

  return (
    <div className="min-h-screen pb-24 text-zinc-900" style={{ fontFamily: FONT }}>
      <style>{FX_CSS}</style>

      {/* Header */}
      <div className="tq-rise mb-8 flex flex-col gap-4 border-b border-black/[0.07] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 text-[13px] font-semibold text-[#0071e3]">Direct support routing</div>
          <h1
            className="text-[clamp(34px,5vw,48px)] font-semibold leading-[1.05] tracking-tight bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #4a4a58 100%)' }}
          >
            Specialist queue
          </h1>
          <p className="mt-3 max-w-xl text-[14px] text-zinc-500">Only sanitized customer messages and their routing evidence appear here.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={queue} onChange={event => setQueue(event.target.value)} className={selectCls}>
            <option value="">All queues</option>
            {queues.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={domain} onChange={event => setDomain(event.target.value)} className={selectCls}>
            <option value="">All domains</option>
            {domains.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
          <button
            onClick={load}
            title="Refresh queue"
            className="rounded-full bg-white ring-1 ring-black/[0.08] shadow-sm px-5 py-2 text-[13px] font-medium text-zinc-700 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.10)] active:scale-95 transition-all duration-200"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Simulator */}
      <form
        onSubmit={handleSubmit}
        className="tq-rise mb-8 rounded-3xl bg-[#f5f5f7] ring-1 ring-black/[0.04] p-6"
        style={{ animationDelay: '80ms' }}
      >
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[15px] font-semibold text-zinc-900">Customer ticket simulator</div>
            <p className="mt-1 text-[13px] text-zinc-500">Submit a sanitized test ticket through the same routing path as ingestion.</p>
          </div>
          <select value={simulator.channel} onChange={event => setSimulator(current => ({ ...current, channel: event.target.value }))} className={selectCls}>
            <option value="webhook">Portal</option>
            <option value="chat">Chat</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input value={simulator.subject} onChange={event => setSimulator(current => ({ ...current, subject: event.target.value }))} placeholder="Subject" className={inputCls} />
          <input value={simulator.content} onChange={event => setSimulator(current => ({ ...current, content: event.target.value }))} placeholder="Describe the customer issue..." className={inputCls} />
        </div>
        <button
          disabled={submitting || !simulator.content.trim()}
          className="mt-4 rounded-full px-6 py-2.5 text-[14px] font-medium text-white shadow-[0_4px_14px_rgba(0,113,227,0.35)] hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,113,227,0.45)] active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none"
          style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }}
        >
          {submitting ? 'Routing...' : 'Submit and route ticket'}
        </button>
      </form>

      {/* Queue + detail */}
      <div
        className="tq-rise grid min-h-[520px] overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.07)] lg:grid-cols-[minmax(280px,0.8fr)_minmax(420px,1.2fr)]"
        style={{ animationDelay: '160ms' }}
      >
        <div className="border-b border-black/[0.06] lg:border-b-0 lg:border-r bg-[#fafafc] overflow-y-auto">
          {tickets.length ? tickets.map(ticket => (
            <button
              key={ticket.id}
              onClick={() => setSelectedId(ticket.id)}
              className={`relative w-full border-b border-black/[0.05] p-4 text-left transition-colors duration-150 ${selected?.id === ticket.id ? 'bg-white' : 'hover:bg-white/70'}`}
            >
              {selected?.id === ticket.id && (
                <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full" style={{ background: 'linear-gradient(180deg, #3aa0ff, #0071e3)' }} />
              )}
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${tone[ticket.intent] || tone.general}`}>{ticket.intent}</span>
                <span className="text-[11px] text-zinc-400 capitalize">{ticket.status?.replace('_', ' ')}</span>
              </div>
              <div className="truncate text-[14px] font-medium text-zinc-900">{ticket.subject || 'Untitled support request'}</div>
              <div className="mt-2 flex items-center gap-3 text-[12px] text-zinc-500"><span>{ticket.specialist_queue}</span><span className="capitalize">{ticket.sentiment}</span></div>
            </button>
          )) : (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 p-8 text-center">
              <span className="text-[14px] font-medium text-zinc-700">No tickets in this queue.</span>
              <span className="text-[12px] text-zinc-400">Webhook ingestion will place new tickets here automatically.</span>
            </div>
          )}
        </div>
        <TicketDetail ticket={selected} queues={queues} onStatusChange={handleStatusChange} onReassign={handleReassign} />
      </div>
    </div>
  )
}
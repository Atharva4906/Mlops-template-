import { useEffect, useRef, useState } from 'react'
import { getMLOpsMetrics, getQueues, getRoutingMetrics, getTickets } from '../services/api'

function Bubble({ role, text }) {
  const user = role === 'user'
  return (
    <div className={`mb-5 max-w-[82%] ${user ? 'ml-auto' : ''}`}>
      <div className={`mb-1.5 px-1 text-[12px] font-semibold ${user ? 'text-right text-zinc-500' : 'text-zinc-900'}`}>
        {user ? 'Operator' : 'Routing Assistant'}
      </div>
      <div className={`whitespace-pre-wrap rounded-[22px] px-4 py-3 text-[14px] leading-relaxed shadow-sm ${user ? 'rounded-tr-md text-white' : 'rounded-tl-md bg-white/90 text-zinc-900 ring-1 ring-black/[0.06]'}`}
        style={user ? { background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' } : undefined}
      >
        {text}
      </div>
    </div>
  )
}

const normalise = value => value.toLowerCase().replace(/\s+/g, ' ').trim()

export default function Assistant() {
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Routing Assistant ready. Ask about tickets, queues, routing metrics, drift, model health, or low-confidence cases.' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, busy])

  const push = (role, text) => setMessages(current => [...current, { role, text }])

  const answer = async command => {
    const text = normalise(command)
    const [ticketData, routingData, mlopsData, queueData] = await Promise.all([
      getTickets(),
      getRoutingMetrics(),
      getMLOpsMetrics(),
      getQueues(),
    ])
    const tickets = ticketData.tickets || []
    const routing = routingData || {}
    const mlops = mlopsData || {}
    const queues = queueData.queues || []

    if (text.includes('queue') || text.includes('ticket')) {
      const open = tickets.filter(ticket => ticket.status === 'open').length
      const escalated = tickets.filter(ticket => ticket.status === 'escalated').length
      const distribution = Object.entries(routing.by_queue || {}).map(([name, count]) => `• ${name}: ${count}`).join('\n') || 'No routed tickets yet.'
      push('bot', `Ticket queue snapshot:\n\nTotal tickets: ${tickets.length}\nOpen: ${open}\nEscalated: ${escalated}\n\nQueue distribution:\n${distribution}`)
      return
    }
    if (text.includes('metric') || text.includes('telemetry') || text.includes('health') || text.includes('performance')) {
      push('bot', `Routing telemetry:\n\nTickets: ${mlops.total_tickets || routing.total_tickets || 0}\nAuto-route rate: ${mlops.auto_route_percentage || 0}%\nReassignment rate: ${mlops.bounce_reassignment_percentage || 0}%\nP95 latency: ${mlops.p95_routing_latency_ms || 0} ms\nError rate: ${mlops.error_rate_percentage || 0}%\nModel: ${mlops.current_mlflow_model_version || 'local fallback'}`)
      return
    }
    if (text.includes('drift') || text.includes('model') || text.includes('mlops')) {
      const drift = mlops.drift || {}
      push('bot', `MLOps status:\n\nDrift: ${drift.status || 'not evaluated'}\nProvider: ${drift.provider || 'local-psi'}\nMLflow: ${mlops.mlflow_enabled ? 'connected' : 'local fallback'}\nDVC: ${mlops.dvc_enabled ? 'enabled' : 'not configured'}\nEvidently: ${mlops.evidently_ready ? 'ready' : 'waiting for data or unavailable'}`)
      return
    }
    if (text.includes('queue list') || text.includes('available queue') || text.includes('specialist')) {
      push('bot', queues.length ? `Available specialist queues:\n\n${queues.map(queue => `• ${queue}`).join('\n')}` : 'No specialist queues are configured.')
      return
    }
    if (text.includes('low confidence') || text.includes('triage') || text.includes('uncertain')) {
      const uncertain = tickets.filter(ticket => Number(ticket.confidence || 0) < 0.85)
      push('bot', uncertain.length
        ? `Human-review candidates: ${uncertain.length}\n\n${uncertain.slice(0, 8).map(ticket => `• ${ticket.subject || 'Untitled'} — ${Math.round((ticket.confidence || 0) * 100)}% confidence`).join('\n')}`
        : 'No low-confidence tickets are currently visible.')
      return
    }
    push('bot', 'I can show the ticket queue, available specialist queues, routing metrics, MLOps/drift health, or low-confidence triage candidates.')
  }

  const handleCommand = async raw => {
    const text = raw.trim()
    if (!text || busy) return
    push('user', text)
    setInput('')
    setBusy(true)
    try {
      await answer(text)
    } catch {
      push('bot', 'Unable to read routing data. Check that the FastAPI backend is running.')
    } finally {
      setBusy(false)
    }
  }

  const quick = [
    ['Show the ticket queue', 'Show the ticket queue'],
    ['Check routing telemetry', 'Check routing telemetry'],
    ['Show MLOps and drift health', 'Show MLOps and drift health'],
    ['Find low-confidence tickets', 'Find low-confidence tickets'],
  ]

  return (
    <div className="relative flex h-[calc(100vh-2rem)] min-h-[620px] w-full flex-col overflow-hidden px-6 pb-5 pt-5 text-zinc-900" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f5f7fb 100%)' }}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.07] pb-5">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Ticket Routing Assistant</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Ask questions about queues, tickets, routing quality, and the MLOps lifecycle.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-700 ring-1 ring-emerald-200/70">Routing data connected</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-white/70 shadow-[0_10px_40px_rgba(0,0,0,0.07)] ring-1 ring-black/[0.06] xl:col-span-8">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-6">
            {messages.map((message, index) => <Bubble key={index} role={message.role} text={message.text} />)}
            {busy && <div className="text-[13px] text-zinc-400">Reading ticket-routing data…</div>}
          </div>
          <form onSubmit={event => { event.preventDefault(); handleCommand(input) }} className="flex gap-3 border-t border-black/[0.06] bg-white/70 p-4">
            <input value={input} onChange={event => setInput(event.target.value)} disabled={busy} placeholder="Ask: Which queues have the most tickets?" className="flex-1 rounded-full bg-white px-5 py-3 text-[14px] outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[#0071e3]" />
            <button disabled={busy || !input.trim()} className="rounded-full px-6 py-3 text-[14px] font-medium text-white shadow-sm disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }}>Send</button>
          </form>
        </div>

        <aside className="min-h-0 overflow-y-auto rounded-3xl bg-white/70 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.07)] ring-1 ring-black/[0.06] xl:col-span-4">
          <div className="mb-4 flex items-baseline justify-between"><span className="text-[15px] font-semibold">Quick questions</span><span className="text-[12px] text-zinc-400">Live data</span></div>
          <div className="space-y-2.5">
            {quick.map(([label, command]) => <button key={command} onClick={() => handleCommand(command)} disabled={busy} className="w-full rounded-2xl bg-white p-4 text-left ring-1 ring-black/[0.05] transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"><div className="text-[14px] font-semibold">{label}</div><div className="mt-1 text-[12px] text-zinc-500">Query the current routing state</div></button>)}
          </div>
        </aside>
      </div>
    </div>
  )
}

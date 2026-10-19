import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getMLOpsMetrics, getQueues, getRoutingMetrics, getTickets } from '../services/api'

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

const FX_CSS = `
@keyframes as-pop { from { opacity: 0; transform: translateY(10px) scale(.97) } to { opacity: 1; transform: none } }
@keyframes as-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
@keyframes as-drift-a { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(60px,40px) scale(1.12) } }
@keyframes as-drift-b { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(-50px,-30px) scale(1.1) } }
@keyframes as-sheen { 0% { transform: translateX(-120%) } 60%,100% { transform: translateX(220%) } }
.as-pop { animation: as-pop .38s cubic-bezier(.2,.8,.2,1) both }
.as-rise { animation: as-rise .6s cubic-bezier(.2,.8,.2,1) both }
.as-blob-a { animation: as-drift-a 18s ease-in-out infinite }
.as-blob-b { animation: as-drift-b 22s ease-in-out infinite }
.as-send { position: relative; overflow: hidden }
.as-send::after { content: ''; position: absolute; inset: 0; width: 40%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.45), transparent); transform: translateX(-120%) }
.as-send:hover:not(:disabled)::after { animation: as-sheen .9s ease }
@media (prefers-reduced-motion: reduce) { .as-pop, .as-rise, .as-blob-a, .as-blob-b { animation: none !important } .as-send:hover::after { animation: none !important } }
`

function Bubble({ role, text }) {
  const user = role === 'user'
  return (
    <div className={`as-pop mb-6 max-w-[80%] ${user ? 'ml-auto' : ''}`}>
      <div className={`mb-1.5 px-1 text-[13px] font-semibold ${user ? 'text-right text-zinc-500' : 'text-zinc-900'}`}>
        {user ? 'Operator' : 'Routing Assistant'}
      </div>
      <div className={`whitespace-pre-wrap rounded-[24px] px-5 py-3.5 text-[16px] leading-[1.65] ${user ? 'rounded-tr-md text-white shadow-[0_6px_20px_rgba(0,113,227,0.35)]' : 'rounded-tl-md bg-white/90 text-zinc-900 ring-1 ring-black/[0.06] shadow-[0_4px_16px_rgba(0,0,0,0.06)]'}`}
        style={user ? { background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 60%, #0a5fd0 100%)' } : undefined}
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

  /* If the dashboard search sent a query, run it once on arrival */
  const location = useLocation()
  const ranInitial = useRef(false)
  useEffect(() => {
    const q = location.state?.query
    if (q && !ranInitial.current) {
      ranInitial.current = true
      handleCommand(q)
    }
  }, [])

  const quick = [
    ['Show the ticket queue', 'Show the ticket queue'],
    ['Check routing telemetry', 'Check routing telemetry'],
    ['Show MLOps and drift health', 'Show MLOps and drift health'],
    ['Find low-confidence tickets', 'Find low-confidence tickets'],
  ]

  const glass = 'bg-white/70 backdrop-blur-xl ring-1 ring-black/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.07)]'

  return (
    <div
      className="relative flex h-[calc(100vh-4rem)] min-h-[620px] w-full flex-col overflow-hidden px-4 pb-4 pt-4 lg:px-8 text-zinc-900"
      style={{ fontFamily: FONT, background: 'linear-gradient(180deg, #ffffff 0%, #f5f7fb 100%)' }}
    >
      <style>{FX_CSS}</style>

      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="as-blob-a absolute -left-20 -top-24 h-[420px] w-[420px] rounded-full bg-sky-300/30 blur-3xl" />
        <div className="as-blob-b absolute -right-24 top-1/3 h-[460px] w-[460px] rounded-full bg-violet-300/25 blur-3xl" />
        <div className="as-blob-a absolute -bottom-32 left-1/3 h-[380px] w-[380px] rounded-full bg-rose-200/25 blur-3xl" />
      </div>

      <div className="as-rise relative mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.07] pb-4">
        <div>
          <h1
            className="bg-clip-text text-[28px] font-semibold tracking-tight text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #3a3a44 100%)' }}
          >
            Ticket Routing Assistant
          </h1>
          <p className="mt-1 text-[13px] text-zinc-500">Ask questions about queues, tickets, routing quality, and the MLOps lifecycle.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-700 ring-1 ring-emerald-200/70">Routing data connected</span>
      </div>

      <div className="relative grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Chat window */}
        <div className={`as-rise flex min-h-0 flex-col overflow-hidden rounded-3xl ${glass}`} style={{ animationDelay: '80ms' }}>
          {/* Mac-style title bar */}
          <div className="group/win relative flex h-[48px] shrink-0 select-none items-center border-b border-black/[0.06] bg-[#f5f5f7]/90 px-4" aria-hidden="true">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 items-center justify-center rounded-full bg-[#ff5f57] text-[9px] font-bold leading-none text-black/50 ring-1 ring-black/10"><span className="opacity-0 transition-opacity group-hover/win:opacity-100">×</span></span>
              <span className="flex h-3 w-3 items-center justify-center rounded-full bg-[#febc2e] text-[11px] font-bold leading-none text-black/50 ring-1 ring-black/10"><span className="-mt-[1px] opacity-0 transition-opacity group-hover/win:opacity-100">−</span></span>
              <span className="flex h-3 w-3 items-center justify-center rounded-full bg-[#28c840] text-[10px] font-bold leading-none text-black/50 ring-1 ring-black/10"><span className="opacity-0 transition-opacity group-hover/win:opacity-100">+</span></span>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 text-[12px] font-medium text-zinc-500">Routing Assistant</div>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-10 scroll-smooth">
            {messages.map((message, index) => <Bubble key={index} role={message.role} text={message.text} />)}
            {busy && (
              <div className="as-pop mb-4 max-w-[82%]">
                <div className="mb-1.5 px-1 text-[12px] font-semibold text-zinc-500">Reading ticket-routing data…</div>
                <div className="inline-flex items-center gap-1.5 rounded-[22px] rounded-tl-md bg-white/90 px-4 py-3.5 ring-1 ring-black/[0.06] shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto border-t border-black/[0.06] bg-white/60 px-5 py-3 xl:hidden">
            {quick.map(([label, command]) => (
              <button
                key={command}
                onClick={() => handleCommand(command)}
                disabled={busy}
                className="shrink-0 rounded-full bg-white px-4 py-2 text-[13px] font-medium text-zinc-700 ring-1 ring-black/[0.08] transition-all hover:-translate-y-0.5 hover:text-[#0071e3] hover:shadow-md active:scale-95 disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={event => { event.preventDefault(); handleCommand(input) }} className="flex gap-3 border-t border-black/[0.06] bg-white/70 p-5 backdrop-blur">
            <input
              value={input}
              onChange={event => setInput(event.target.value)}
              disabled={busy}
              placeholder="Ask: Which queues have the most tickets?"
              className="flex-1 rounded-full bg-white px-6 py-4 text-[16px] outline-none ring-1 ring-black/[0.08] shadow-sm transition-all duration-200 placeholder:text-zinc-400 focus:ring-2 focus:ring-[#0071e3] focus:shadow-[0_0_0_6px_rgba(0,113,227,0.12)]"
            />
            <button
              disabled={busy || !input.trim()}
              className="as-send rounded-full px-8 py-4 text-[16px] font-medium text-white shadow-[0_4px_14px_rgba(0,113,227,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,113,227,0.45)] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }}
            >
              Send
            </button>
          </form>
        </div>

        {/* Quick questions */}
        <aside className={`as-rise hidden min-h-0 overflow-y-auto rounded-3xl p-5 xl:block ${glass}`} style={{ animationDelay: '160ms' }}>
          <div className="mb-4 flex items-baseline justify-between"><span className="text-[15px] font-semibold">Quick questions</span><span className="text-[12px] text-zinc-400">Live data</span></div>
          <div className="space-y-2.5">
            {quick.map(([label, command]) => (
              <button
                key={command}
                onClick={() => handleCommand(command)}
                disabled={busy}
                className="w-full rounded-2xl bg-white p-4 text-left ring-1 ring-black/[0.05] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.10)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                <div className="text-[14px] font-semibold">{label}</div>
                <div className="mt-1 text-[12px] text-zinc-500">Query the current routing state</div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
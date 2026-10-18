import { useEffect, useState, useRef } from 'react'
import {
  getProjects,
  getProjectContext,
  getProjectEmails,
  getProjectDocuments,
  deleteProject,
  getStats,
  getSummary,
  getActionsBySections,
  getCalendarEvents
} from '../services/api'

// --- BUBBLE COMPONENTS ---
function BotBubble({ text }) {
  return (
    <div className="nx-pop max-w-[80%] mb-5">
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <span className="text-[12px] font-semibold text-zinc-900">LangGraph Router</span>
        <span className="text-[11px] text-zinc-400">groq://llama-3.3-70b</span>
      </div>
      <div className="rounded-[22px] rounded-tl-md bg-white/90 backdrop-blur px-4 py-3 text-[14px] text-zinc-900 leading-relaxed whitespace-pre-wrap ring-1 ring-black/[0.06] shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
        {text}
      </div>
    </div>
  )
}

function UserBubble({ text }) {
  return (
    <div className="nx-pop max-w-[75%] mb-5 ml-auto">
      <div className="mb-1.5 px-1 text-right text-[12px] font-semibold text-zinc-500">
        MLOps Operator
      </div>
      <div className="rounded-[22px] rounded-tr-md text-white px-4 py-3 text-[14px] leading-relaxed text-left shadow-[0_6px_20px_rgba(0,113,227,0.35)]"
        style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 60%, #0a5fd0 100%)' }}>
        {text}
      </div>
    </div>
  )
}

const FX_CSS = `
@keyframes nx-pop { from { opacity: 0; transform: translateY(10px) scale(.97) } to { opacity: 1; transform: none } }
@keyframes nx-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
@keyframes nx-drift-a { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(60px,40px) scale(1.12) } }
@keyframes nx-drift-b { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(-50px,-30px) scale(1.1) } }
@keyframes nx-sheen { 0% { transform: translateX(-120%) } 60%,100% { transform: translateX(220%) } }
.nx-pop { animation: nx-pop .38s cubic-bezier(.2,.8,.2,1) both }
.nx-rise { animation: nx-rise .6s cubic-bezier(.2,.8,.2,1) both }
.nx-blob-a { animation: nx-drift-a 18s ease-in-out infinite }
.nx-blob-b { animation: nx-drift-b 22s ease-in-out infinite }
.nx-send { position: relative; overflow: hidden }
.nx-send::after { content: ''; position: absolute; inset: 0; width: 40%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.45), transparent); transform: translateX(-120%); }
.nx-send:hover:not(:disabled)::after { animation: nx-sheen .9s ease }
@media (prefers-reduced-motion: reduce) { .nx-pop, .nx-rise, .nx-blob-a, .nx-blob-b { animation: none !important } .nx-send:hover::after { animation: none !important } }
`

// --- SYSTEM PROMPT ---
const SYSTEM_PROMPT = `You are the Nexus AI Operations Router. Map the user's request to one of these intents:
- "list_projects": Show all workspaces/projects.
- "project_context": Show info/context about a specific project. (Requires "project" parameter).
- "delete_project": Delete/remove a project. (Requires "project" parameter).
- "get_stats": Show system metrics, throughput, or stats.
- "get_summary": Show the daily AI digest or summary.
- "list_pending_actions": Show pending tasks, escalations, or queued items.
- "get_calendar": Show upcoming meetings or schedule.
- "unknown": Request does not match any of the above.

Output ONLY valid JSON in this exact format:
{"action": "intent_name", "project": "name if applicable or empty string"}
Do not include markdown blocks, backticks, or any other text.`

export default function Assistant() {
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Console initialized. Command me to list projects, analyze context, check system telemetry, view pending queues, or review calendar events.' }
  ])
  const [input, setInput] = useState('')
  const [projects, setProjects] = useState([])
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    refreshProjects()
  }, [])

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, busy])

  const refreshProjects = async () => {
    try {
      const d = await getProjects()
      setProjects(d.projects || [])
    } catch {
      setProjects([])
    }
  }

  const push = (role, text) => setMessages(m => [...m, { role, text }])

  const findProject = (name) => {
    if (!name) return null
    const lcName = name.toLowerCase()
    return projects.find(p => (p.name || '').toLowerCase() === lcName)
      || projects.find(p => (p.name || '').toLowerCase().includes(lcName))
  }

  // --- INTENT EXECUTION ENGINE ---
  const runIntent = async (intent) => {
    const action = intent?.action
    const projectName = intent?.project?.trim() || ''

    try {
      switch (action) {
        case 'list_projects': {
          if (!projects.length) return push('bot', 'Scanning... No active projects found.')
          push('bot', 'System Projects:\n\n' + projects.map(p => `• ${p.name || 'Unnamed'}`).join('\n'))
          break
        }

        case 'project_context': {
          if (!projectName) return push('bot', 'Action required: Please specify project name.')
          const proj = findProject(projectName)
          if (!proj) return push('bot', `Error: Workspace "${projectName}" not recognized.`)
          
          setBusy(true)
          const [ctx, emailsRes, docsRes] = await Promise.all([
            getProjectContext(proj.id).catch(() => ({})),
            getProjectEmails(proj.id).catch(() => ({ emails: [] })),
            getProjectDocuments(proj.id).catch(() => ({ documents: [] })),
          ])
          
          const summary = [
            `Target: ${proj.name || 'Untitled'}`,
            `Signal: ${emailsRes.emails?.length || 0} emails / ${docsRes.documents?.length || 0} docs`,
            `────────────────────────`,
            `${ctx.context || ctx.full_text || '(Empty context cluster)'}`.slice(0, 600) + '...'
          ].join('\n')
          
          push('bot', summary)
          break
        }

        case 'delete_project': {
          if (!projectName) return push('bot', 'Action required: Name the target for deletion.')
          const proj = findProject(projectName)
          if (!proj) return push('bot', `Error: Project "${projectName}" not found.`)
          
          setBusy(true)
          await deleteProject(proj.id)
          push('bot', `Success: Project "${proj.name}" has been purged.`)
          await refreshProjects()
          break
        }

        case 'get_stats': {
          setBusy(true)
          const st = await getStats()
          push('bot', `System Telemetry:\n\nProcessed Items: ${st.total_processed || 0}\nEscalations: ${st.escalations || 0}\nScheduled Meetings: ${st.total_meetings || 0}`)
          break
        }

        case 'get_summary': {
          setBusy(true)
          const sum = await getSummary()
          push('bot', `AI Digest:\n\n${sum.summary || 'No digest available currently.'}`)
          break
        }

        case 'list_pending_actions': {
          setBusy(true)
          const sections = await getActionsBySections()
          const queues = Object.entries(sections || {})
            .filter(([_, arr]) => Array.isArray(arr) && arr.length > 0)
            .map(([name, arr]) => `• ${name}: ${arr.length} pending`)
          
          if (!queues.length) return push('bot', 'All clear. No pending actions in the queue.')
          push('bot', `Operational Queue Snapshot:\n\n${queues.join('\n')}`)
          break
        }

        case 'get_calendar': {
          setBusy(true)
          const cal = await getCalendarEvents(7)
          const events = cal.events || []
          if (!events.length) return push('bot', 'No upcoming calendar events detected for the next 7 days.')
          push('bot', `Upcoming Schedule:\n\n${events.slice(0,5).map(e => `• ${e.title} (${new Date(e.start).toLocaleDateString()})`).join('\n')}`)
          break
        }

        default:
          push('bot', 'Instruction unclear. I can fetch system stats, list pending actions, review calendars, or inspect project contexts.')
      }
    } catch (e) {
      console.error(e)
      push('bot', 'Critical: Failed to resolve request data.')
    } finally {
      setBusy(false)
    }
  }

  // --- GROQ API CALL ---
  const callGroq = async (userText) => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY
    if (!apiKey) throw new Error('Missing VITE_GROQ_API_KEY in frontend env')
    
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userText }],
      })
    })
    
    if (!res.ok) throw new Error(`Groq error ${res.status}`)
    const data = await res.json()
    let raw = data?.choices?.[0]?.message?.content || '{}'
    
    // Safety cleanup in case LLM adds markdown backticks
    raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
    return JSON.parse(raw)
  }

  const handleCommand = async (raw) => {
    const text = raw.trim()
    if (!text || busy) return
    
    push('user', text)
    setInput('')
    setBusy(true)
    
    try {
      const intent = await callGroq(text)
      await runIntent(intent || { action: 'unknown', project: '' })
    } catch (e) {
      push('bot', `System Exception: ${e.message}`)
      setBusy(false)
    }
  }

  const card = 'border border-white/70 ring-1 ring-black/[0.05] bg-white/70 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.07)]'
  const tile = 'w-full text-left p-3.5 rounded-2xl bg-white/80 ring-1 ring-black/[0.05] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.10)] active:scale-[0.98] active:translate-y-0 cursor-pointer disabled:opacity-50 disabled:pointer-events-none'

  return (
    <div
      className="relative w-full max-w-none mx-0 h-[calc(100vh-2rem)] flex flex-col text-zinc-900 overflow-hidden px-6 pt-5 pb-5"
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif',
        background: 'linear-gradient(180deg, #ffffff 0%, #f5f7fb 100%)',
      }}
    >
      <style>{FX_CSS}</style>

      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="nx-blob-a absolute -top-24 -left-20 w-[420px] h-[420px] rounded-full bg-sky-300/30 blur-3xl" />
        <div className="nx-blob-b absolute top-1/3 -right-24 w-[460px] h-[460px] rounded-full bg-violet-300/25 blur-3xl" />
        <div className="nx-blob-a absolute -bottom-32 left-1/3 w-[380px] h-[380px] rounded-full bg-rose-200/25 blur-3xl" />
      </div>

      {/* Header */}
      <div className="nx-rise relative pb-5 mb-5 border-b border-black/[0.07] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1
              className="text-[28px] font-semibold tracking-tight bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #3a3a44 100%)' }}
            >
              AI Ops & Triage Console
            </h1>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/80 ring-1 ring-black/[0.06] text-zinc-500 text-[11px] font-medium shadow-sm">
              Router v2.0
            </span>
          </div>
          <p className="text-[13px] text-zinc-500 mt-0.5">
            LangGraph intent orchestration, system telemetry & workspace queue inspection
          </p>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-2.5">
          <div className="px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur ring-1 ring-black/[0.06] shadow-sm text-[12px] text-zinc-500">
            Engine <span className="font-semibold text-zinc-900 ml-1">Groq LPU</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur ring-1 ring-black/[0.06] shadow-sm text-[12px] text-zinc-500">
            Workspaces <span className="font-semibold text-zinc-900 ml-1">{projects.length}</span>
          </div>
        </div>
      </div>

      {/* 2-column workspace */}
      <div className="relative flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Chat */}
        <div className={`nx-rise xl:col-span-8 h-full min-h-0 rounded-3xl overflow-hidden flex flex-col ${card}`} style={{ animationDelay: '80ms' }}>

          {/* Title bar */}
          <div className="bg-white/60 backdrop-blur border-b border-black/[0.06] px-5 py-3.5 flex items-center justify-between shrink-0">
            <span className="text-[13px] font-medium text-zinc-700 truncate">
              session://operator_01@langgraph-router
            </span>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200/70 px-2.5 py-1 rounded-full shrink-0">
              PII Guard Active
            </span>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto p-6 space-y-1 scroll-smooth"
          >
            {messages.map((m, i) => (
              <div key={i}>
                {m.role === 'user' ? <UserBubble text={m.text} /> : <BotBubble text={m.text} />}
              </div>
            ))}

            {/* Thinking indicator */}
            {busy && (
              <div className="nx-pop max-w-[80%] mb-4">
                <div className="mb-1.5 px-1 text-[12px] font-semibold text-zinc-500">
                  Executing intent graph…
                </div>
                <div className="bg-white/90 ring-1 ring-black/[0.06] shadow-[0_4px_16px_rgba(0,0,0,0.06)] px-4 py-3.5 rounded-[22px] rounded-tl-md inline-flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleCommand(input); }}
            className="p-4 bg-white/60 backdrop-blur border-t border-black/[0.06] flex items-center gap-3 shrink-0"
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Query MLOps router (e.g., 'Show telemetry', 'What's in the queue?', or 'List projects')"
              className="flex-1 bg-white text-zinc-900 placeholder:text-zinc-400 px-5 py-3 rounded-full text-[14px] outline-none ring-1 ring-black/[0.08] shadow-sm focus:ring-2 focus:ring-[#0071e3] focus:shadow-[0_0_0_6px_rgba(0,113,227,0.12)] transition-all duration-200"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="nx-send h-[44px] px-6 text-white rounded-full font-medium text-[14px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,113,227,0.45)] active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shrink-0 shadow-[0_4px_14px_rgba(0,113,227,0.35)]"
              style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }}
            >
              Send
            </button>
          </form>
        </div>

        {/* Right column */}
        <div className="xl:col-span-4 h-full min-h-0 overflow-y-auto space-y-5 pr-0.5">

          {/* Quick directives */}
          <div className={`nx-rise rounded-3xl p-5 ${card}`} style={{ animationDelay: '160ms' }}>
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-[15px] font-semibold text-zinc-900">Quick directives</span>
              <span className="text-[12px] text-zinc-400">One click</span>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => handleCommand('Check system telemetry and stats')}
                disabled={busy}
                className={`${tile} hover:bg-sky-50`}
              >
                <div className="text-[14px] font-semibold text-zinc-900">System Telemetry</div>
                <div className="text-[12px] text-zinc-500 mt-0.5">Processed volume & escalations</div>
              </button>

              <button
                onClick={() => handleCommand('What actions are pending in the queue?')}
                disabled={busy}
                className={`${tile} hover:bg-amber-50`}
              >
                <div className="text-[14px] font-semibold text-zinc-900">Operational Queue</div>
                <div className="text-[12px] text-zinc-500 mt-0.5">Pending HITL triage actions</div>
              </button>

              <button
                onClick={() => handleCommand('list projects')}
                disabled={busy}
                className={`${tile} hover:bg-violet-50`}
              >
                <div className="text-[14px] font-semibold text-zinc-900">List Workspaces</div>
                <div className="text-[12px] text-zinc-500 mt-0.5">Inspect active routing queues</div>
              </button>
            </div>
          </div>

          {/* Syntax examples */}
          <div className={`nx-rise rounded-3xl p-5 ${card}`} style={{ animationDelay: '240ms' }}>
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-[15px] font-semibold text-zinc-900">Try asking</span>
              <span className="text-[12px] text-zinc-400">Click to run</span>
            </div>
            <div className="space-y-2 text-[13px]">
              {[
                ['Show me the daily AI digest.', 'Show me the daily AI digest.'],
                ["What's on my calendar?", "What's on my calendar?"],
                ['Delete the obsolete project.', 'Delete the obsolete project.'],
              ].map(([label, cmd]) => (
                <div
                  key={cmd}
                  onClick={() => handleCommand(cmd)}
                  className="px-4 py-3 bg-white/80 ring-1 ring-black/[0.05] rounded-2xl text-zinc-600 hover:text-zinc-900 transition-all duration-200 hover:translate-x-1 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)] active:scale-[0.98] cursor-pointer"
                >
                  "{label}"
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
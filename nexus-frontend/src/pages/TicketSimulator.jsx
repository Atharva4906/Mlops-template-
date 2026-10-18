import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createTicket } from '../services/api'
import { useApp } from '../context/AppContext'

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

const channels = [
  { value: 'webhook', label: 'Customer portal' },
  { value: 'chat', label: 'Chat' },
  { value: 'email', label: 'Email' },
]

const samples = [
  { label: 'Account access', subject: 'Unable to access my account', content: 'I cannot sign in to my account since this morning. The page keeps showing an error after I enter my password.' },
  { label: 'Billing question', subject: 'Question about my invoice', content: 'My latest invoice shows a higher amount than usual. Could you explain the extra charge and confirm whether it is correct?' },
  { label: 'Urgent fraud report', subject: 'Unauthorised payment on my card', content: 'I just noticed a payment I did not make. Please block my card immediately and tell me what to do next, this is urgent.' },
]

const FX_CSS = `
@keyframes ts-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
.ts-rise { animation: ts-rise .6s cubic-bezier(.2,.8,.2,1) both }
.ts-seg-ind { transition: transform .35s cubic-bezier(.2,.8,.2,1) }
@media (prefers-reduced-motion: reduce) { .ts-rise { animation: none !important } .ts-seg-ind { transition: none } }
`

export default function TicketSimulator() {
  const { dispatch, toast } = useApp()
  const navigate = useNavigate()
  const [form, setForm] = useState({ channel: 'webhook', subject: '', content: '' })
  const [submitting, setSubmitting] = useState(false)

  const submit = async event => {
    event.preventDefault()
    if (!form.content.trim()) return
    setSubmitting(true)
    try {
      const response = await createTicket(form)
      dispatch({ type: 'PREPEND_TICKET', ticket: response.ticket })
      toast('Ticket ingested and routed', 'ok')
      navigate('/inbox')
    } catch {
      toast('Ticket submission failed', 'warn')
    } finally {
      setSubmitting(false)
    }
  }

  const channelIdx = Math.max(0, channels.findIndex(c => c.value === form.channel))
  const words = form.content.trim() ? form.content.trim().split(/\s+/).length : 0

  return (
    <div className="mx-auto max-w-4xl pb-24 text-zinc-900" style={{ fontFamily: FONT }}>
      <style>{FX_CSS}</style>

      <Link
        to="/"
        className="ts-rise mb-8 inline-flex rounded-full bg-[#f5f5f7] px-4 py-2 text-[13px] font-medium text-zinc-600 ring-1 ring-black/[0.04] transition-all duration-200 hover:-translate-x-0.5 hover:bg-white hover:text-zinc-900 hover:shadow-sm"
      >
        Back to command center
      </Link>

      {/* Header */}
      <div className="ts-rise mb-10 text-center" style={{ animationDelay: '60ms' }}>
        <div className="mb-3 text-[13px] font-semibold text-[#0071e3]">Customer ticket simulator</div>
        <h1
          className="text-[clamp(36px,6vw,60px)] font-semibold leading-[1.02] tracking-tight bg-clip-text text-transparent"
          style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #4a4a58 100%)' }}
        >
          Submit a request
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-6 text-zinc-500">
          This uses the same ingestion and routing contract as an incoming customer message.
        </p>
      </div>

      {/* Mac-style window */}
      <form
        onSubmit={submit}
        className="ts-rise overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.08] shadow-[0_24px_70px_rgba(0,0,0,0.12)]"
        style={{ animationDelay: '140ms' }}
      >
        {/* title bar */}
        <div className="group/win relative flex h-[42px] items-center border-b border-black/[0.06] bg-[#f5f5f7] px-4 select-none" aria-hidden="true">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-[#ff5f57] text-[9px] font-bold leading-none text-black/50 ring-1 ring-black/10">
              <span className="opacity-0 transition-opacity group-hover/win:opacity-100">×</span>
            </span>
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-[#febc2e] text-[11px] font-bold leading-none text-black/50 ring-1 ring-black/10">
              <span className="-mt-[1px] opacity-0 transition-opacity group-hover/win:opacity-100">−</span>
            </span>
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-[#28c840] text-[10px] font-bold leading-none text-black/50 ring-1 ring-black/10">
              <span className="opacity-0 transition-opacity group-hover/win:opacity-100">+</span>
            </span>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 text-[12px] font-medium text-zinc-500">New ticket</div>
        </div>

        <div className="p-6 sm:p-8">
          {/* channel */}
          <div className="mb-6">
            <div className="mb-2 text-[13px] font-semibold text-zinc-900">Source channel</div>
            <div className="relative grid grid-cols-3 rounded-2xl bg-[#f5f5f7] p-1 ring-1 ring-black/[0.05]" role="tablist" aria-label="Source channel">
              <span
                className="ts-seg-ind absolute bottom-1 left-1 top-1 rounded-xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.12)]"
                style={{ width: 'calc((100% - 8px) / 3)', transform: `translateX(${channelIdx * 100}%)` }}
              />
              {channels.map(c => (
                <button
                  key={c.value}
                  type="button"
                  role="tab"
                  aria-selected={form.channel === c.value}
                  onClick={() => setForm(current => ({ ...current, channel: c.value }))}
                  className={`relative z-10 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors cursor-pointer ${form.channel === c.value ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* samples */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[12px] font-medium text-zinc-400">Try a sample</span>
            {samples.map(s => (
              <button
                key={s.label}
                type="button"
                onClick={() => setForm(current => ({ ...current, subject: s.subject, content: s.content }))}
                className="rounded-full bg-[#f5f5f7] px-3.5 py-1.5 text-[12px] font-medium text-zinc-600 ring-1 ring-black/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-[#0071e3] hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] active:scale-95 cursor-pointer"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* subject */}
          <label className="mb-5 block">
            <span className="mb-2 block text-[13px] font-semibold text-zinc-900">Subject</span>
            <input
              value={form.subject}
              onChange={event => setForm(current => ({ ...current, subject: event.target.value }))}
              placeholder="Unable to access my account"
              className="w-full rounded-2xl bg-[#f5f5f7] px-4 py-3 text-[15px] text-zinc-900 outline-none ring-1 ring-transparent transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-[#0071e3] focus:shadow-[0_0_0_6px_rgba(0,113,227,0.12)]"
            />
          </label>

          {/* message */}
          <label className="mb-2 block">
            <span className="mb-2 block text-[13px] font-semibold text-zinc-900">Message</span>
            <textarea
              required
              minLength={1}
              rows="8"
              value={form.content}
              onChange={event => setForm(current => ({ ...current, content: event.target.value }))}
              onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') submit(event) }}
              placeholder="Describe the issue, impact, and any relevant details..."
              className="w-full resize-y rounded-2xl bg-[#f5f5f7] px-4 py-3 text-[15px] leading-7 text-zinc-900 outline-none ring-1 ring-transparent transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-[#0071e3] focus:shadow-[0_0_0_6px_rgba(0,113,227,0.12)]"
            />
          </label>
          <div className="mb-6 flex justify-between text-[12px] text-zinc-400">
            <span>{words} {words === 1 ? 'word' : 'words'} · {form.content.length} characters</span>
            <span className="hidden sm:inline text-zinc-300">Ctrl / ⌘ + Enter to submit</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/[0.06] pt-6">
            <p className="text-[12px] text-zinc-400">After submitting, you'll be taken to the specialist queue.</p>
            <button
              disabled={submitting || !form.content.trim()}
              className="rounded-full px-7 py-3 text-[14px] font-medium text-white shadow-[0_4px_14px_rgba(0,113,227,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,113,227,0.45)] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }}
            >
              {submitting ? 'Routing...' : 'Submit and route'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createTicket } from '../services/api'
import { useApp } from '../context/AppContext'

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

const samples = [
  { label: 'Billing issue', subject: 'Charged twice this month', content: 'Hi, I was charged twice for my subscription this month. Could you please check and refund the duplicate payment?' },
  { label: 'Login problem', subject: 'Cannot sign in to my account', content: 'I keep getting an error when I try to sign in. I have reset my password twice but it still does not work.' },
  { label: 'Suspicious charge', subject: 'Unrecognised transaction', content: 'There is a transaction on my statement that I do not recognise. I think someone may have used my card, please help urgently.' },
]

const steps = [
  { title: 'Scrubbed', text: 'Personal data is removed before processing.' },
  { title: 'Classified', text: 'Intent, sentiment and urgency are detected.' },
  { title: 'Routed', text: 'The ticket lands in the right specialist queue.' },
]

const FX_CSS = `
@keyframes up-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
@keyframes up-pop { from { opacity: 0; transform: translateY(8px) scale(.96) } to { opacity: 1; transform: none } }
.up-rise { animation: up-rise .6s cubic-bezier(.2,.8,.2,1) both }
.up-pop { animation: up-pop .35s cubic-bezier(.2,.8,.2,1) both }
@media (prefers-reduced-motion: reduce) { .up-rise, .up-pop { animation: none !important } }
`

export default function Upload() {
  const { dispatch, toast } = useApp()
  const [content, setContent] = useState('')
  const [subject, setSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')

  const submit = async event => {
    event.preventDefault()
    if (!content.trim()) return
    setSending(true)
    setStatus('')
    try {
      const response = await createTicket({ channel: 'chat', subject, content })
      dispatch({ type: 'PREPEND_TICKET', ticket: response.ticket })
      setSubject('')
      setContent('')
      setStatus('Message routed to the specialist queue.')
      toast('Chat message ingested and routed', 'ok')
    } catch {
      setStatus('Unable to route this message.')
      toast('Chat ingestion failed', 'warn')
    } finally {
      setSending(false)
    }
  }

  const failed = status.startsWith('Unable')
  const words = content.trim() ? content.trim().split(/\s+/).length : 0

  return (
    <div className="mx-auto max-w-4xl pb-24 text-zinc-900" style={{ fontFamily: FONT }}>
      <style>{FX_CSS}</style>

      {/* Header */}
      <div className="up-rise mb-10 text-center">
        <div className="mb-3 text-[13px] font-semibold text-[#0071e3]">Chat ingestion</div>
        <h1
          className="text-[clamp(36px,6vw,60px)] font-semibold leading-[1.02] tracking-tight bg-clip-text text-transparent"
          style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #4a4a58 100%)' }}
        >
          Send a message
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-6 text-zinc-500">
          Paste a customer conversation and route it into the live specialist queue for classification and specialist handling.
        </p>
      </div>

      {/* Mac-style composer window */}
      <form
        onSubmit={submit}
        className="up-rise overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.08] shadow-[0_24px_70px_rgba(0,0,0,0.12)]"
        style={{ animationDelay: '100ms' }}
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
          <div className="absolute left-1/2 -translate-x-1/2 text-[12px] font-medium text-zinc-500">New conversation</div>
        </div>

        {/* quick-fill samples */}
        <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] px-5 py-3">
          <span className="mr-1 text-[12px] font-medium text-zinc-400">Try a sample</span>
          {samples.map(s => (
            <button
              key={s.label}
              type="button"
              onClick={() => { setSubject(s.subject); setContent(s.content); setStatus('') }}
              className="rounded-full bg-[#f5f5f7] px-3.5 py-1.5 text-[12px] font-medium text-zinc-600 ring-1 ring-black/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-[#0071e3] hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] active:scale-95 cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* subject row, like a mail composer */}
        <div className="flex items-center gap-3 border-b border-black/[0.06] px-5">
          <span className="text-[13px] font-medium text-zinc-400">Subject</span>
          <input
            value={subject}
            onChange={event => setSubject(event.target.value)}
            placeholder="Conversation subject (optional)"
            className="w-full bg-transparent py-4 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-300"
          />
        </div>

        {/* message */}
        <textarea
          required
          rows="9"
          value={content}
          onChange={event => setContent(event.target.value)}
          onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') submit(event) }}
          placeholder="Paste the customer message or chat transcript..."
          className="block w-full resize-y bg-transparent px-5 py-4 text-[15px] leading-7 text-zinc-900 outline-none placeholder:text-zinc-300"
        />

        {/* live preview, shown like an iMessage bubble */}
        {content.trim() && (
          <div className="up-pop border-t border-black/[0.06] bg-[#fafafc] px-5 py-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Preview</div>
            <div className="max-w-[80%] rounded-[20px] rounded-tl-md bg-[#e9e9eb] px-4 py-2.5 text-[14px] leading-relaxed text-zinc-900 whitespace-pre-wrap break-words">
              {content.length > 400 ? `${content.slice(0, 400)}…` : content}
            </div>
          </div>
        )}

        {/* toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/[0.06] bg-white px-5 py-4">
          <div className="text-[12px] text-zinc-400">
            {words} {words === 1 ? 'word' : 'words'} · {content.length} characters
            <span className="ml-3 hidden text-zinc-300 sm:inline">Ctrl / ⌘ + Enter to send</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/inbox" className="text-[13px] font-medium text-zinc-500 transition-colors hover:text-[#0071e3]">Open specialist queue</Link>
            <button
              disabled={sending || !content.trim()}
              className="rounded-full px-6 py-2.5 text-[14px] font-medium text-white shadow-[0_4px_14px_rgba(0,113,227,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,113,227,0.45)] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }}
            >
              {sending ? 'Routing...' : 'Send to queue'}
            </button>
          </div>
        </div>
      </form>

      {/* status */}
      {status && (
        <div className={`up-pop mx-auto mt-6 w-fit rounded-full px-5 py-2.5 text-[14px] font-medium ring-1 ${failed ? 'bg-rose-50 text-rose-700 ring-rose-200/70' : 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'}`}>
          {status}
        </div>
      )}

      {/* what happens next */}
      <div className="mt-12 grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className="up-rise rounded-3xl bg-[#f5f5f7] p-5 text-center ring-1 ring-black/[0.04] transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_14px_36px_rgba(0,0,0,0.09)]"
            style={{ animationDelay: `${260 + i * 100}ms` }}
          >
            <div className="text-[12px] font-semibold text-[#0071e3]">{String(i + 1).padStart(2, '0')}</div>
            <div className="mt-2 text-[15px] font-semibold text-zinc-900">{s.title}</div>
            <p className="mt-1 text-[12px] leading-5 text-zinc-500">{s.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
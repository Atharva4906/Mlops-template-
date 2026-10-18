import { useState } from 'react'
import { CheckCircle2, Loader2, MessageSquareText, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { createTicket } from '../services/api'
import { useApp } from '../context/AppContext'

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

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <div className="mb-10 border-b border-brand-border/30 pb-8">
        <div className="mb-3 flex items-center gap-2 font-space text-[11px] uppercase tracking-widest text-cyan-300"><MessageSquareText size={14} /> Chat ingestion</div>
        <h1 className="font-bebas text-6xl uppercase tracking-tight text-white">Send a message</h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">Paste a customer conversation and route it into the live specialist queue. BRD generation is disabled.</p>
      </div>
      <form onSubmit={submit} className="border border-brand-border bg-[#080808] p-6 sm:p-8">
        <input value={subject} onChange={event => setSubject(event.target.value)} placeholder="Conversation subject (optional)" className="mb-4 w-full border border-brand-border bg-black p-3 text-sm text-white outline-none focus:border-cyan-300" />
        <textarea required rows="10" value={content} onChange={event => setContent(event.target.value)} placeholder="Paste the customer message or chat transcript..." className="w-full resize-y border border-brand-border bg-black p-3 text-sm leading-6 text-white outline-none focus:border-cyan-300" />
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button disabled={sending || !content.trim()} className="flex items-center gap-2 bg-cyan-300 px-5 py-3 font-space text-[10px] font-bold uppercase tracking-widest text-black hover:bg-white disabled:opacity-40"><Send size={14} /> {sending ? 'Routing...' : 'Send to queue'}</button>
          <Link to="/inbox" className="font-space text-[10px] uppercase tracking-widest text-brand-muted hover:text-white">Open specialist queue</Link>
        </div>
        {status && <div className="mt-5 flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 size={14} /> {status}</div>}
      </form>
    </div>
  )
}

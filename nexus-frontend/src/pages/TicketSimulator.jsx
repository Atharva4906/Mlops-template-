import { useState } from 'react'
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { createTicket } from '../services/api'
import { useApp } from '../context/AppContext'

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

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <Link to="/" className="mb-8 inline-flex items-center gap-2 font-space text-[10px] uppercase tracking-widest text-brand-muted hover:text-white"><ArrowLeft size={14} /> Back to command center</Link>
      <div className="mb-8 border-b border-brand-border/30 pb-8">
        <div className="mb-3 flex items-center gap-2 font-space text-[11px] uppercase tracking-widest text-cyan-300"><ShieldCheck size={14} /> Customer ticket simulator</div>
        <h1 className="font-bebas text-6xl uppercase tracking-tight text-white">Submit a request</h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">This uses the same ingestion and routing contract as an incoming customer message.</p>
      </div>
      <form onSubmit={submit} className="border border-brand-border bg-[#080808] p-6 sm:p-8">
        <label className="mb-5 block font-space text-[10px] uppercase tracking-widest text-brand-muted">
          Source channel
          <select value={form.channel} onChange={event => setForm(current => ({ ...current, channel: event.target.value }))} className="mt-2 w-full border border-brand-border bg-black p-3 text-sm text-white outline-none focus:border-cyan-300">
            <option value="webhook">Customer portal</option>
            <option value="chat">Chat</option>
            <option value="email">Email</option>
          </select>
        </label>
        <label className="mb-5 block font-space text-[10px] uppercase tracking-widest text-brand-muted">
          Subject
          <input value={form.subject} onChange={event => setForm(current => ({ ...current, subject: event.target.value }))} placeholder="Unable to access my account" className="mt-2 w-full border border-brand-border bg-black p-3 text-sm text-white outline-none focus:border-cyan-300" />
        </label>
        <label className="mb-6 block font-space text-[10px] uppercase tracking-widest text-brand-muted">
          Message
          <textarea required minLength={1} rows="8" value={form.content} onChange={event => setForm(current => ({ ...current, content: event.target.value }))} placeholder="Describe the issue, impact, and any relevant details..." className="mt-2 w-full resize-y border border-brand-border bg-black p-3 text-sm leading-6 text-white outline-none focus:border-cyan-300" />
        </label>
        <button disabled={submitting || !form.content.trim()} className="flex items-center gap-2 bg-cyan-300 px-5 py-3 font-space text-[10px] font-bold uppercase tracking-widest text-black hover:bg-white disabled:opacity-40"><Send size={14} /> {submitting ? 'Routing...' : 'Submit and route'}</button>
      </form>
    </div>
  )
}

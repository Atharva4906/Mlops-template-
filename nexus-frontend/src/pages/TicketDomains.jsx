import { useEffect, useState } from 'react'
import { Check, Edit3, Loader2, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import {
  createTicketDomain,
  deactivateTicketDomain,
  getIntentDomains,
  getQueues,
  getTicketDomains,
  updateIntentDomain,
  updateTicketDomain,
} from '../services/api'
import { useApp } from '../context/AppContext'

const emptyForm = { slug: '', name: '', description: '', specialist_queue: '', is_active: true }

export default function TicketDomains() {
  const { toast = () => {} } = useApp() || {}
  const [domains, setDomains] = useState([])
  const [queues, setQueues] = useState([])
  const [routes, setRoutes] = useState({})
  const [form, setForm] = useState(emptyForm)
  const [editingSlug, setEditingSlug] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [domainResponse, queueResponse, routeResponse] = await Promise.all([
        getTicketDomains(true),
        getQueues(),
        getIntentDomains(),
      ])
      setDomains(domainResponse.domains || [])
      setQueues(queueResponse.queues || [])
      setRoutes(routeResponse.routes || {})
    } catch {
      toast('Unable to load ticket domains', 'warn')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const updateField = (field, value) => setForm(current => ({ ...current, [field]: value }))

  const resetForm = () => {
    setForm(emptyForm)
    setEditingSlug(null)
  }

  const submit = async event => {
    event.preventDefault()
    if (!form.name.trim() || !form.specialist_queue.trim() || (!editingSlug && !form.slug.trim())) return
    setSaving(true)
    try {
      if (editingSlug) {
        await updateTicketDomain(editingSlug, {
          name: form.name,
          description: form.description,
          specialist_queue: form.specialist_queue,
          is_active: form.is_active,
        })
        toast('Ticket domain updated', 'ok')
      } else {
        await createTicketDomain({ ...form, slug: form.slug.trim().toLowerCase() })
        toast('Ticket domain created', 'ok')
      }
      resetForm()
      await load()
    } catch {
      toast('Unable to save ticket domain', 'warn')
    } finally {
      setSaving(false)
    }
  }

  const edit = domain => {
    setEditingSlug(domain.slug)
    setForm({
      slug: domain.slug,
      name: domain.name,
      description: domain.description || '',
      specialist_queue: domain.specialist_queue,
      is_active: domain.is_active,
    })
  }

  const deactivate = async slug => {
    if (!window.confirm(`Deactivate ${slug}?`)) return
    try {
      await deactivateTicketDomain(slug)
      toast('Ticket domain deactivated', 'ok')
      await load()
    } catch {
      toast('Unable to deactivate ticket domain', 'warn')
    }
  }

  const changeRoute = async (intent, domain) => {
    try {
      await updateIntentDomain(intent, domain)
      setRoutes(current => ({ ...current, [intent]: domain }))
      toast(`${intent} now routes to ${domain}`, 'ok')
    } catch {
      toast('Unable to update intent route', 'warn')
    }
  }

  const activeDomains = domains.filter(domain => domain.is_active)

  return (
    <div className="pb-24">
      <div className="mb-10 flex flex-col gap-5 border-b border-brand-border/30 pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="htag mb-4 flex items-center gap-2 font-space text-[11px] uppercase tracking-widest text-brand-muted">
            <ShieldCheck size={13} className="text-brand-blue" /> Admin / Routing Configuration
          </div>
          <h1 className="font-bebas text-[clamp(42px,7vw,82px)] leading-[0.86] uppercase tracking-tight text-white">Ticket Domains</h1>
          <p className="mt-3 max-w-2xl font-dm text-sm text-brand-muted">Configure the destinations selected after ingestion, privacy scrubbing, and intent prediction.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 self-start border border-brand-border px-4 py-3 font-space text-[10px] uppercase tracking-widest text-brand-muted hover:border-brand-blue hover:text-white md:self-auto">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(280px,0.8fr)_minmax(420px,1.2fr)]">
        <form onSubmit={submit} className="border border-brand-border bg-[#080808] p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="font-space text-[10px] uppercase tracking-[0.24em] text-brand-yellow">{editingSlug ? 'Edit domain' : 'New domain'}</div>
            {editingSlug && <button type="button" onClick={resetForm} className="text-[10px] uppercase tracking-widest text-brand-muted hover:text-white">Cancel</button>}
          </div>
          {!editingSlug && <label className="mb-4 block font-space text-[10px] uppercase tracking-widest text-brand-muted">Slug<input value={form.slug} onChange={event => updateField('slug', event.target.value)} placeholder="customer-success" className="mt-2 w-full border border-brand-border bg-black p-3 font-dm text-sm text-white outline-none focus:border-brand-blue" /></label>}
          <label className="mb-4 block font-space text-[10px] uppercase tracking-widest text-brand-muted">Name<input value={form.name} onChange={event => updateField('name', event.target.value)} placeholder="Customer Success" className="mt-2 w-full border border-brand-border bg-black p-3 font-dm text-sm text-white outline-none focus:border-brand-blue" /></label>
          <label className="mb-4 block font-space text-[10px] uppercase tracking-widest text-brand-muted">Description<textarea value={form.description} onChange={event => updateField('description', event.target.value)} rows="3" className="mt-2 w-full resize-none border border-brand-border bg-black p-3 font-dm text-sm text-white outline-none focus:border-brand-blue" /></label>
          <label className="mb-6 block font-space text-[10px] uppercase tracking-widest text-brand-muted">Specialist queue<select value={form.specialist_queue} onChange={event => updateField('specialist_queue', event.target.value)} className="mt-2 w-full border border-brand-border bg-black p-3 font-dm text-sm text-white outline-none focus:border-brand-blue"><option value="">Select queue</option>{queues.map(queue => <option key={queue} value={queue}>{queue}</option>)}</select></label>
          <button disabled={saving} className="flex w-full items-center justify-center gap-2 bg-white px-4 py-3 font-space text-[10px] font-bold uppercase tracking-widest text-black hover:bg-brand-blue disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : editingSlug ? <Check size={14} /> : <Plus size={14} />}
            {editingSlug ? 'Save domain' : 'Create domain'}
          </button>
        </form>

        <div className="space-y-8">
          <section>
            <div className="mb-4 font-space text-[10px] uppercase tracking-[0.24em] text-brand-blue">Active domains</div>
            <div className="space-y-3">
              {activeDomains.map(domain => <div key={domain.slug} className="flex items-start justify-between gap-4 border border-brand-border bg-[#080808] p-5"><div><div className="font-dm text-base font-medium text-white">{domain.name}</div><div className="mt-1 font-space text-[10px] uppercase tracking-widest text-brand-muted">{domain.slug} · {domain.specialist_queue}</div><p className="mt-3 text-xs leading-5 text-brand-muted">{domain.description || 'No description'}</p></div><div className="flex shrink-0 gap-2"><button onClick={() => edit(domain)} title="Edit domain" className="border border-brand-border p-2 text-brand-muted hover:border-brand-blue hover:text-white"><Edit3 size={14} /></button><button onClick={() => deactivate(domain.slug)} title="Deactivate domain" className="border border-brand-border p-2 text-brand-muted hover:border-red-400 hover:text-red-300"><Trash2 size={14} /></button></div></div>)}
              {!activeDomains.length && <div className="border border-dashed border-brand-border p-8 text-center text-sm text-brand-muted">No active ticket domains.</div>}
            </div>
          </section>

          <section>
            <div className="mb-4 font-space text-[10px] uppercase tracking-[0.24em] text-brand-yellow">Intent routing</div>
            <div className="divide-y divide-brand-border border border-brand-border bg-[#080808]">
              {Object.keys(routes).sort().map(intent => <div key={intent} className="flex items-center justify-between gap-4 p-4"><span className="font-dm text-sm capitalize text-white">{intent}</span><select value={routes[intent]} onChange={event => changeRoute(intent, event.target.value)} className="max-w-[220px] border border-brand-border bg-black p-2 font-space text-[10px] uppercase tracking-widest text-brand-muted outline-none focus:border-brand-blue">{activeDomains.map(domain => <option key={domain.slug} value={domain.slug}>{domain.name}</option>)}</select></div>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

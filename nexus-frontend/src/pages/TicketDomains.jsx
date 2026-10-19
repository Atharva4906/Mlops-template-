import { useEffect, useState } from 'react'
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

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

const FX_CSS = `
@keyframes td-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
@keyframes td-pop { from { opacity: 0; transform: translateY(8px) scale(.97) } to { opacity: 1; transform: none } }
.td-rise { animation: td-rise .55s cubic-bezier(.2,.8,.2,1) both }
.td-pop { animation: td-pop .35s cubic-bezier(.2,.8,.2,1) both }
@media (prefers-reduced-motion: reduce) { .td-rise, .td-pop { animation: none !important } }
`

const emptyForm = { slug: '', name: '', description: '', specialist_queue: '', is_active: true }

const fieldCls = 'mt-2 w-full rounded-2xl bg-[#f5f5f7] px-4 py-3 text-[14px] text-zinc-900 outline-none ring-1 ring-transparent transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-[#0071e3] focus:shadow-[0_0_0_6px_rgba(0,113,227,0.12)]'
const labelCls = 'mb-4 block text-[13px] font-semibold text-zinc-900'

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
    <div className="pb-24 text-zinc-900" style={{ fontFamily: FONT }}>
      <style>{FX_CSS}</style>

      {/* Header */}
      <div className="td-rise mb-10 flex flex-col gap-5 border-b border-black/[0.07] pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 text-[13px] font-semibold text-[#0071e3]">Admin / Routing configuration</div>
          <h1
            className="bg-clip-text text-[clamp(36px,6vw,60px)] font-semibold leading-[1.02] tracking-tight text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #4a4a58 100%)' }}
          >
            Ticket Domains
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-zinc-500">Configure the destinations selected after ingestion, privacy scrubbing, and intent prediction.</p>
        </div>
        <button
          onClick={load}
          className="self-start rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-zinc-700 ring-1 ring-black/[0.08] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.10)] active:scale-95 md:self-auto"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(300px,0.8fr)_minmax(420px,1.2fr)]">
        {/* Form in a Mac-style window */}
        <form
          onSubmit={submit}
          className="td-rise h-fit overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.08] shadow-[0_24px_70px_rgba(0,0,0,0.10)]"
          style={{ animationDelay: '80ms' }}
        >
          <div className="group/win relative flex h-[42px] select-none items-center border-b border-black/[0.06] bg-[#f5f5f7] px-4" aria-hidden="true">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 items-center justify-center rounded-full bg-[#ff5f57] text-[9px] font-bold leading-none text-black/50 ring-1 ring-black/10"><span className="opacity-0 transition-opacity group-hover/win:opacity-100">×</span></span>
              <span className="flex h-3 w-3 items-center justify-center rounded-full bg-[#febc2e] text-[11px] font-bold leading-none text-black/50 ring-1 ring-black/10"><span className="-mt-[1px] opacity-0 transition-opacity group-hover/win:opacity-100">−</span></span>
              <span className="flex h-3 w-3 items-center justify-center rounded-full bg-[#28c840] text-[10px] font-bold leading-none text-black/50 ring-1 ring-black/10"><span className="opacity-0 transition-opacity group-hover/win:opacity-100">+</span></span>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 text-[12px] font-medium text-zinc-500">{editingSlug ? 'Edit domain' : 'New domain'}</div>
          </div>

          <div className="p-6">
            {editingSlug && (
              <div className="td-pop mb-5 flex items-center justify-between rounded-2xl bg-[#0071e3]/[0.07] px-4 py-2.5 text-[13px] text-[#0071e3]">
                <span>Editing <span className="font-semibold">{editingSlug}</span></span>
                <button type="button" onClick={resetForm} className="font-medium text-zinc-500 transition-colors hover:text-zinc-900">Cancel</button>
              </div>
            )}

            {!editingSlug && (
              <label className={labelCls}>Slug
                <input value={form.slug} onChange={event => updateField('slug', event.target.value)} placeholder="customer-success" className={fieldCls} />
              </label>
            )}
            <label className={labelCls}>Name
              <input value={form.name} onChange={event => updateField('name', event.target.value)} placeholder="Customer Success" className={fieldCls} />
            </label>
            <label className={labelCls}>Description
              <textarea value={form.description} onChange={event => updateField('description', event.target.value)} rows="3" className={`${fieldCls} resize-none`} />
            </label>
            <label className="mb-6 block text-[13px] font-semibold text-zinc-900">Specialist queue
              <select value={form.specialist_queue} onChange={event => updateField('specialist_queue', event.target.value)} className={`${fieldCls} cursor-pointer`}>
                <option value="">Select queue</option>
                {queues.map(queue => <option key={queue} value={queue}>{queue}</option>)}
              </select>
            </label>
            <button
              disabled={saving}
              className="w-full rounded-full px-5 py-3 text-[14px] font-medium text-white shadow-[0_4px_14px_rgba(0,113,227,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,113,227,0.45)] active:scale-95 disabled:pointer-events-none disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }}
            >
              {saving ? 'Saving…' : editingSlug ? 'Save domain' : 'Create domain'}
            </button>
          </div>
        </form>

        <div className="space-y-8">
          {/* Active domains */}
          <section>
            <div className="td-rise mb-4 text-[15px] font-semibold text-zinc-900" style={{ animationDelay: '120ms' }}>
              Active domains <span className="ml-1 text-[13px] font-medium text-zinc-400">{activeDomains.length}</span>
            </div>
            <div className="space-y-3">
              {activeDomains.map((domain, i) => (
                <div
                  key={domain.slug}
                  className="td-rise flex items-start justify-between gap-4 rounded-3xl bg-white p-5 ring-1 ring-black/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.09)]"
                  style={{ animationDelay: `${160 + Math.min(i, 8) * 60}ms` }}
                >
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold text-zinc-900">{domain.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                      <span className="rounded-full bg-[#f5f5f7] px-2.5 py-0.5 font-medium text-zinc-600 ring-1 ring-black/[0.04]">{domain.slug}</span>
                      <span className="rounded-full bg-sky-50 px-2.5 py-0.5 font-medium text-sky-700 ring-1 ring-sky-200/70">{domain.specialist_queue}</span>
                    </div>
                    <p className="mt-3 text-[13px] leading-5 text-zinc-500">{domain.description || 'No description'}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => edit(domain)} title="Edit domain" className="rounded-full bg-[#f5f5f7] px-4 py-1.5 text-[12px] font-medium text-zinc-700 transition-all duration-200 hover:bg-white hover:text-[#0071e3] hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)] active:scale-95">Edit</button>
                    <button onClick={() => deactivate(domain.slug)} title="Deactivate domain" className="rounded-full bg-red-50 px-4 py-1.5 text-[12px] font-medium text-red-600 ring-1 ring-red-200/70 transition-all duration-200 hover:bg-red-100 active:scale-95">Deactivate</button>
                  </div>
                </div>
              ))}
              {!activeDomains.length && (
                <div className="rounded-3xl border border-dashed border-black/[0.15] bg-[#fafafc] p-8 text-center text-[14px] text-zinc-500">No active ticket domains.</div>
              )}
            </div>
          </section>

          {/* Intent routing */}
          <section>
            <div className="td-rise mb-4 text-[15px] font-semibold text-zinc-900" style={{ animationDelay: '200ms' }}>Intent routing</div>
            <div className="td-rise divide-y divide-black/[0.06] overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.05)]" style={{ animationDelay: '240ms' }}>
              {Object.keys(routes).sort().map(intent => (
                <div key={intent} className="flex items-center justify-between gap-4 p-4 transition-colors duration-150 hover:bg-[#f5f5f7]">
                  <span className="text-[14px] font-medium capitalize text-zinc-900">{intent}</span>
                  <select
                    value={routes[intent]}
                    onChange={event => changeRoute(intent, event.target.value)}
                    className="max-w-[220px] cursor-pointer rounded-full bg-white px-4 py-2 text-[13px] font-medium text-zinc-700 shadow-sm ring-1 ring-black/[0.08] outline-none transition-all focus:ring-2 focus:ring-[#0071e3]"
                  >
                    {activeDomains.map(domain => <option key={domain.slug} value={domain.slug}>{domain.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
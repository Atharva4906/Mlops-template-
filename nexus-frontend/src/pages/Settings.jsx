import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { getAuthStatus, scanIngest, login } from '../services/api'

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

const FX_CSS = `
@keyframes st-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
@keyframes st-ring { 0% { box-shadow: 0 0 0 0 rgba(244,63,94,.35) } 100% { box-shadow: 0 0 0 12px rgba(244,63,94,0) } }
.st-rise { animation: st-rise .55s cubic-bezier(.2,.8,.2,1) both }
.st-ring { animation: st-ring 1.8s ease-out infinite }
@media (prefers-reduced-motion: reduce) { .st-rise, .st-ring { animation: none !important } }
`

// iOS-style switch row
function ProtocolSwitch({ title, description, checked, onChange, isRequired, badgeText }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(!checked) } }}
      className={`group mb-3 flex cursor-pointer items-start gap-4 rounded-3xl p-5 ring-1 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] ${
        checked ? 'bg-white ring-[#0071e3]/30 shadow-[0_8px_26px_rgba(0,113,227,0.10)]' : 'bg-[#f5f5f7] ring-black/[0.05]'
      }`}
    >
      <div className="flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold text-zinc-900">{title}</span>
          {badgeText && (
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${
              isRequired ? 'bg-rose-50 text-rose-700 ring-rose-200/70' : 'bg-sky-50 text-sky-700 ring-sky-200/70'
            }`}>
              {badgeText}
            </span>
          )}
        </div>
        <div className="text-[13px] leading-relaxed text-zinc-500">{description}</div>
      </div>
      <div className={`relative mt-0.5 h-[28px] w-[48px] shrink-0 rounded-full transition-colors duration-300 ${checked ? 'bg-[#34c759]' : 'bg-zinc-300'}`}>
        <div className={`absolute top-[2px] h-[24px] w-[24px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.3)] transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${checked ? 'left-[22px]' : 'left-[2px]'}`} />
      </div>
    </div>
  )
}

function ParameterInput({ label, type = 'text', value, onChange }) {
  return (
    <div className="mb-6 relative">
      <label className="mb-2 block text-[13px] font-semibold text-zinc-900">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-2xl bg-[#f5f5f7] px-4 py-3 text-[15px] text-zinc-900 outline-none ring-1 ring-transparent transition-all duration-200 focus:bg-white focus:ring-2 focus:ring-[#0071e3] focus:shadow-[0_0_0_6px_rgba(0,113,227,0.12)]"
      />
    </div>
  )
}

export default function Settings() {
  const { toast = () => {} } = useApp() || {}

  const [buf, setBuf] = useState('10')
  const [ws, setWs] = useState('09:00')
  const [we, setWe] = useState('18:00')
  const [thr, setThr] = useState(70)

  const [autoApprove, setAutoApprove] = useState(false)
  const [autoCalendar, setAutoCalendar] = useState(true)
  const [sentiment, setSentiment] = useState(true)

  const [authStatus, setAuthStatus] = useState(false)
  const [emailOwner, setEmailOwner] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    getAuthStatus().then(res => {
      setAuthStatus(res.authenticated || false)
      if (res.email) setEmailOwner(res.email)
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(r => setTimeout(r, 1200))
    setIsSaving(false)
    toast('✓ Directives Committed to Core', 'ok')
  }

  const handleForceSync = async () => {
    setSyncing(true)
    try {
      await scanIngest()
      toast('Ingestion Cycle Started', 'ok')
    } catch { toast('Cycle Failed', 'err') }
    setSyncing(false)
  }

  /* const handleForceCluster = async () => {
    setClustering(true)
    try {
      await forceRecluster(10)
      toast('Re-clustering Sequence Active', 'ok')
    } catch { toast('Sequence Failed', 'err') }
    setClustering(false)
  } */

  const sectionTitle = 'mb-5 text-[15px] font-semibold text-zinc-900'

  return (
    <div className="pb-24 text-zinc-900" style={{ fontFamily: FONT }}>
      <style>{FX_CSS}</style>

      {/* Header Area */}
      <div className="st-rise mb-12 border-b border-black/[0.07] pb-8">
        <div className="mb-3 text-[13px] font-semibold text-[#0071e3]">System configuration / v2.4</div>
        <h1
          className="bg-clip-text text-[clamp(36px,6vw,60px)] font-semibold leading-[1.02] tracking-tight text-transparent"
          style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #4a4a58 100%)' }}
        >
          Agent Directives
        </h1>
      </div>

      <div className="grid items-start gap-10 lg:grid-cols-2">
        {/* Left Column: Automation Protocols */}
        <div className="space-y-10">

          {/* Auth status panel */}
          <div
            className={`st-rise relative overflow-hidden rounded-3xl p-6 ring-1 transition-colors duration-700 ${
              authStatus ? 'bg-emerald-50/70 ring-emerald-200/70' : 'bg-rose-50/70 ring-rose-200/70'
            }`}
            style={{ animationDelay: '80ms' }}
          >
            <div className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl opacity-40 ${authStatus ? 'bg-emerald-300' : 'bg-rose-300'}`} />
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`h-3 w-3 shrink-0 rounded-full ${authStatus ? 'bg-emerald-500' : 'bg-rose-500 st-ring'}`} aria-hidden="true" />
                <div>
                  <div className="text-[17px] font-semibold tracking-tight text-zinc-900">
                    {authStatus ? 'Auth bridge: active' : 'Auth bridge: disconnected'}
                  </div>
                  <div className="mt-0.5 text-[13px] text-zinc-500">
                    {authStatus ? `Identity: ${emailOwner}` : 'System restricted. Re-authenticate.'}
                  </div>
                </div>
              </div>
              {!authStatus && (
                <button
                  onClick={login}
                  className="shrink-0 rounded-full px-5 py-2 text-[13px] font-medium text-white shadow-[0_4px_14px_rgba(0,113,227,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,113,227,0.45)] active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }}
                >
                  Login
                </button>
              )}
            </div>
          </div>

          <section className="st-rise" style={{ animationDelay: '160ms' }}>
            <div className={sectionTitle}>Automation protocols</div>
            <ProtocolSwitch
              title="Auto-Approve Low Urgency"
              description="Agent can bypass human review for tier-3 queries."
              checked={autoApprove}
              onChange={setAutoApprove}
              badgeText="High Risk"
              isRequired={true}
            />
            <ProtocolSwitch
              title="Calendar Synthesis"
              description="Direct injection of meeting signals into the Ticket Routing Agent Google API integration."
              checked={autoCalendar}
              onChange={setAutoCalendar}
            />
            <ProtocolSwitch
              title="Sentiment Escalation"
              description="Auto-route high-emotion signals to human override."
              checked={sentiment}
              onChange={setSentiment}
              badgeText="Recommended"
              isRequired={true}
            />
          </section>
        </div>

        {/* Right Column: Parameters & Triggers */}
        <div className="space-y-10">

          <section className="st-rise rounded-3xl bg-white p-8 ring-1 ring-black/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.06)]" style={{ animationDelay: '120ms' }}>
            <div className={sectionTitle}>Operational limits</div>

            <ParameterInput label="Buffer window (mins)" type="number" value={buf} onChange={setBuf} />

            <div className="mb-8 grid grid-cols-2 gap-6">
              <ParameterInput label="Cycle start" type="time" value={ws} onChange={setWs} />
              <ParameterInput label="Cycle end" type="time" value={we} onChange={setWe} />
            </div>

            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <label className="text-[13px] font-semibold text-zinc-900">Confidence threshold</label>
                <span className="text-[28px] font-semibold leading-none tracking-tight text-[#0071e3] tabular-nums">{thr}%</span>
              </div>
              <div className="group relative h-2 rounded-full bg-black/[0.08]">
                <div
                  className="absolute h-full rounded-full transition-all duration-150"
                  style={{ width: `${thr}%`, background: 'linear-gradient(90deg, #3aa0ff, #0071e3)' }}
                />
                <div
                  className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.3)] ring-1 ring-black/[0.06] transition-all duration-150 group-hover:scale-110"
                  style={{ left: `calc(${thr}% - 12px)` }}
                />
                <input
                  type="range" min="0" max="100" value={thr}
                  onChange={e => setThr(e.target.value)}
                  aria-label="Confidence threshold"
                  className="absolute -top-2 h-6 w-full cursor-pointer opacity-0"
                />
              </div>
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>0% Human only</span>
                <span>100% Fully autonomous</span>
              </div>
            </div>
          </section>

          <section className="st-rise" style={{ animationDelay: '200ms' }}>
            <div className={sectionTitle}>Pipeline overrides</div>

            <button
              onClick={handleForceSync}
              disabled={syncing}
              className="group flex w-full items-center justify-between rounded-3xl bg-[#f5f5f7] p-5 text-left ring-1 ring-black/[0.05] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_32px_rgba(244,63,94,0.12)] hover:ring-rose-200 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
            >
              <div>
                <div className="text-[16px] font-semibold text-zinc-900 transition-colors group-hover:text-rose-600">
                  {syncing ? 'Gmail scrape running…' : 'Trigger Gmail scrape'}
                </div>
                <div className="mt-0.5 text-[13px] text-zinc-500">Force context ingestion</div>
              </div>
              <span className="rounded-full bg-white px-4 py-1.5 text-[12px] font-medium text-zinc-600 ring-1 ring-black/[0.06] transition-colors group-hover:text-rose-600">
                {syncing ? 'Running' : 'Run now'}
              </span>
            </button>

            {/*
            <button
              onClick={handleForceCluster}
              disabled={clustering}
              className="w-full flex items-center justify-between p-5 border border-brand-border bg-[#0a0a0a] hover:border-brand-yellow/50 group transition-all"
            >
              <div className="text-left flex items-center gap-4">
                <div>
                  <div className="font-bebas text-lg text-white group-hover:text-brand-yellow">Re-Cluster Nodes</div>
                  <div className="font-dm text-[11px] text-brand-muted uppercase tracking-tight mt-0.5">Reset grouping algorithm</div>
                </div>
              </div>
            </button>
            */}
          </section>
        </div>
      </div>
    </div>
  )
}
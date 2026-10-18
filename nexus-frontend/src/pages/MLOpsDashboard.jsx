import { useCallback, useEffect, useState } from 'react'
import { getMLOpsMetrics, evaluateMLOpsDrift, retrainMLOps, promoteMLOpsModel } from '../services/api'

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

const FX_CSS = `
@keyframes ml-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
@keyframes ml-grow { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes ml-shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
@keyframes ml-pop { from { opacity: 0; transform: translateY(8px) scale(.97) } to { opacity: 1; transform: none } }
.ml-rise { animation: ml-rise .55s cubic-bezier(.2,.8,.2,1) both }
.ml-grow { transform-origin: left; animation: ml-grow 1s .25s cubic-bezier(.2,.8,.2,1) both }
.ml-pop { animation: ml-pop .35s cubic-bezier(.2,.8,.2,1) both }
.ml-skel { background-image: linear-gradient(100deg, #f1f1f4 30%, #fafafc 50%, #f1f1f4 70%); background-size: 200% 100%; animation: ml-shimmer 1.6s linear infinite }
@media (prefers-reduced-motion: reduce) { .ml-rise, .ml-grow, .ml-pop, .ml-skel { animation: none !important } }
`

const ACCENTS = {
  sky: { text: 'text-sky-600', bar: '#0ea5e9', glow: 'hover:shadow-[0_14px_36px_rgba(14,165,233,0.18)]' },
  amber: { text: 'text-amber-600', bar: '#f59e0b', glow: 'hover:shadow-[0_14px_36px_rgba(245,158,11,0.18)]' },
  violet: { text: 'text-violet-600', bar: '#8b5cf6', glow: 'hover:shadow-[0_14px_36px_rgba(139,92,246,0.18)]' },
  emerald: { text: 'text-emerald-600', bar: '#10b981', glow: 'hover:shadow-[0_14px_36px_rgba(16,185,129,0.18)]' },
  rose: { text: 'text-rose-600', bar: '#f43f5e', glow: 'hover:shadow-[0_14px_36px_rgba(244,63,94,0.18)]' },
  zinc: { text: 'text-zinc-600', bar: '#71717a', glow: 'hover:shadow-[0_14px_36px_rgba(0,0,0,0.10)]' },
}

function MetricCard({ label, value, detail, accent = 'sky', percent, delay = 0 }) {
  const c = ACCENTS[accent] || ACCENTS.sky
  const pct = typeof percent === 'number' && isFinite(percent) ? Math.max(0, Math.min(100, percent)) : null
  return (
    <div
      className={`ml-rise rounded-3xl bg-[#f5f5f7] p-5 ring-1 ring-black/[0.04] transition-all duration-300 hover:-translate-y-1 hover:bg-white ${c.glow}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`text-[13px] font-semibold ${c.text}`}>{label}</div>
      <div className="mt-3 text-[34px] font-semibold leading-none tracking-tight text-zinc-900">{value}</div>
      {detail && <div className="mt-2 text-[12px] text-zinc-500">{detail}</div>}
      {pct !== null && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
          <div className="ml-grow h-full rounded-full" style={{ width: `${pct}%`, background: c.bar }} />
        </div>
      )}
    </div>
  )
}

export default function MLOpsDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    const result = await getMLOpsMetrics()
    setMetrics(result)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const run = async (name, action, successMessage) => {
    setBusy(name)
    setMessage('')
    try {
      await action()
      setMessage(successMessage)
      await refresh()
    } catch (error) {
      setMessage(error.message || `${name} failed`)
    } finally {
      setBusy('')
    }
  }

  if (!metrics) {
    return (
      <div className="pb-10 text-zinc-900" style={{ fontFamily: FONT }}>
        <style>{FX_CSS}</style>
        <div className="mb-8 text-[15px] font-medium text-zinc-500">Loading MLOps telemetry...</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="ml-skel h-[118px] rounded-3xl" />)}
        </div>
      </div>
    )
  }

  const drift = metrics.drift || {}

  const pillBtn = 'rounded-full px-5 py-2.5 text-[13px] font-medium transition-all duration-200 hover:-translate-y-0.5 active:scale-95 disabled:pointer-events-none disabled:opacity-50'
  const primaryStyle = { background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }

  return (
    <div className="space-y-8 pb-10 text-zinc-900" style={{ fontFamily: FONT }}>
      <style>{FX_CSS}</style>

      {/* Header */}
      <div className="ml-rise flex flex-wrap items-end justify-between gap-4 border-b border-black/[0.07] pb-8">
        <div>
          <div className="mb-3 text-[13px] font-semibold text-[#0071e3]">Operations</div>
          <h1
            className="bg-clip-text text-[clamp(36px,6vw,60px)] font-semibold leading-[1.02] tracking-tight text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #4a4a58 100%)' }}
          >
            MLOps lifecycle
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-zinc-500">Monitor routing quality, detect drift, retrain challengers, and promote only validated models.</p>
        </div>
        <button
          onClick={() => run('refresh', refresh, 'Telemetry refreshed')}
          className="rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-zinc-700 shadow-sm ring-1 ring-black/[0.08] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.10)] active:scale-95"
        >
          {busy === 'refresh' ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Auto-route" value={`${metrics.auto_route_percentage}%`} detail={`${metrics.total_tickets} tickets`} accent="emerald" percent={Number(metrics.auto_route_percentage)} delay={60} />
        <MetricCard label="Bounce / reassignment" value={`${metrics.bounce_reassignment_percentage}%`} accent="amber" percent={Number(metrics.bounce_reassignment_percentage)} delay={120} />
        <MetricCard label="Groq fallback" value={`${metrics.groq_fallback_percentage}%`} accent="violet" percent={Number(metrics.groq_fallback_percentage)} delay={180} />
        <MetricCard label="P95 latency" value={`${metrics.p95_routing_latency_ms} ms`} accent="sky" delay={240} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Error rate" value={`${metrics.error_rate_percentage ?? 0}%`} accent="rose" percent={Number(metrics.error_rate_percentage ?? 0)} delay={300} />
        <MetricCard label="LLM tokens" value={metrics.llm_token_count ?? 0} accent="violet" delay={360} />
        <MetricCard label="Token cost" value={`$${Number(metrics.llm_token_cost_usd ?? 0).toFixed(4)}`} accent="zinc" delay={420} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Drift */}
        <section className="ml-rise rounded-3xl bg-white p-6 ring-1 ring-black/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.05)]" style={{ animationDelay: '480ms' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-zinc-900">Drift monitoring</h2>
            <span className={`rounded-full px-3 py-1 text-[12px] font-medium capitalize ring-1 ${drift.status === 'drift' ? 'bg-rose-50 text-rose-700 ring-rose-200/70' : 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'}`}>
              {(drift.status || 'not evaluated').replace(/_/g, ' ')}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-[#f5f5f7] p-4"><div className="text-[12px] font-medium text-zinc-500">Embedding PSI</div><div className="mt-1 text-[20px] font-semibold text-zinc-900">{drift.embedding_psi ?? '—'}</div></div>
            <div className="rounded-2xl bg-[#f5f5f7] p-4"><div className="text-[12px] font-medium text-zinc-500">Queue PSI</div><div className="mt-1 text-[20px] font-semibold text-zinc-900">{drift.queue_distribution_psi ?? '—'}</div></div>
          </div>
          {drift.status === 'waiting_for_data' && (
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-800 ring-1 ring-amber-200/70">
              Waiting for {drift.minimum_samples} baseline and current samples
              ({drift.current_samples ?? 0} current, {drift.baseline_samples ?? 0} baseline).
            </p>
          )}
          <button
            onClick={() => run('drift', evaluateMLOpsDrift, 'Drift evaluation completed')}
            className={`${pillBtn} mt-5 text-white shadow-[0_4px_14px_rgba(0,113,227,0.35)] hover:shadow-[0_8px_22px_rgba(0,113,227,0.45)]`}
            style={primaryStyle}
            disabled={!!busy}
          >
            {busy === 'drift' ? 'Evaluating…' : 'Evaluate drift'}
          </button>
        </section>

        {/* Lifecycle */}
        <section className="ml-rise rounded-3xl bg-white p-6 ring-1 ring-black/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.05)]" style={{ animationDelay: '540ms' }}>
          <h2 className="text-[17px] font-semibold text-zinc-900">Model lifecycle</h2>
          <div className="mt-4 divide-y divide-black/[0.06] text-[14px]">
            <div className="flex justify-between py-3"><span className="text-zinc-500">Champion</span><span className="font-medium text-zinc-900">{metrics.current_mlflow_model_version}</span></div>
            <div className="flex justify-between py-3"><span className="text-zinc-500">MLflow</span><span className="font-medium text-zinc-900">{metrics.mlflow_enabled ? 'connected' : 'not configured'}</span></div>
            <div className="flex justify-between py-3"><span className="text-zinc-500">DVC</span><span className="font-medium text-zinc-900">{metrics.dvc_enabled ? 'enabled' : 'not configured'}</span></div>
            <div className="flex justify-between py-3"><span className="text-zinc-500">Evidently</span><span className="font-medium text-zinc-900">{metrics.evidently_ready ? 'active' : metrics.evidently_enabled ? 'installed, waiting for data' : 'not installed'}</span></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => run('retrain', retrainMLOps, 'Challenger training completed')}
              className={`${pillBtn} bg-[#f5f5f7] text-zinc-800 ring-1 ring-black/[0.06] hover:bg-white hover:shadow-[0_8px_22px_rgba(0,0,0,0.10)]`}
              disabled={!!busy}
            >
              {busy === 'retrain' ? 'Training…' : 'Train challenger'}
            </button>
            <button
              onClick={() => run('promote', promoteMLOpsModel, 'Promotion decision completed')}
              className={`${pillBtn} text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)] hover:shadow-[0_8px_22px_rgba(139,92,246,0.45)]`}
              style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' }}
              disabled={!!busy}
            >
              {busy === 'promote' ? 'Promoting…' : 'Promote challenger'}
            </button>
          </div>
        </section>
      </div>

      {message && (
        <div className="ml-pop w-fit max-w-full rounded-full bg-[#0071e3]/[0.08] px-5 py-3 text-[14px] font-medium text-[#0071e3] ring-1 ring-[#0071e3]/20">
          {message}
        </div>
      )}
    </div>
  )
}
import { useCallback, useEffect, useState } from 'react'
import { Activity, BrainCircuit, RefreshCw, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react'
import { getMLOpsMetrics, evaluateMLOpsDrift, retrainMLOps, promoteMLOpsModel } from '../services/api'

function MetricCard({ label, value, detail, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center justify-between text-zinc-400 text-xs uppercase tracking-wider">
        <span>{label}</span>
        <Icon size={16} className="text-cyan-300" />
      </div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      {detail && <div className="mt-1 text-xs text-zinc-500">{detail}</div>}
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
    return <div className="text-zinc-400 py-20">Loading MLOps telemetry...</div>
  }

  const drift = metrics.drift || {}
  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Operations</div>
          <h1 className="mt-2 text-4xl font-semibold text-white">MLOps lifecycle</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">Monitor routing quality, detect drift, retrain challengers, and promote only validated models.</p>
        </div>
        <button onClick={() => run('refresh', refresh, 'Telemetry refreshed')} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10">
          <RefreshCw size={15} className={busy === 'refresh' ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Auto-route" value={`${metrics.auto_route_percentage}%`} detail={`${metrics.total_tickets} tickets`} icon={TrendingUp} />
        <MetricCard label="Bounce / reassignment" value={`${metrics.bounce_reassignment_percentage}%`} icon={Activity} />
        <MetricCard label="Groq fallback" value={`${metrics.groq_fallback_percentage}%`} icon={BrainCircuit} />
        <MetricCard label="P95 latency" value={`${metrics.p95_routing_latency_ms} ms`} icon={Sparkles} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Error rate" value={`${metrics.error_rate_percentage ?? 0}%`} icon={ShieldAlert} />
        <MetricCard label="LLM tokens" value={metrics.llm_token_count ?? 0} icon={BrainCircuit} />
        <MetricCard label="Token cost" value={`$${Number(metrics.llm_token_cost_usd ?? 0).toFixed(4)}`} icon={Activity} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-white">Drift monitoring</h2>
            <span className={`rounded-full px-3 py-1 text-xs ${drift.status === 'drift' ? 'bg-rose-400/15 text-rose-300' : 'bg-emerald-400/15 text-emerald-300'}`}>
              {drift.status || 'not evaluated'}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-black/20 p-3"><div className="text-zinc-500">Embedding PSI</div><div className="mt-1 text-white">{drift.embedding_psi ?? '—'}</div></div>
            <div className="rounded-lg bg-black/20 p-3"><div className="text-zinc-500">Queue PSI</div><div className="mt-1 text-white">{drift.queue_distribution_psi ?? '—'}</div></div>
          </div>
          {drift.status === 'waiting_for_data' && (
            <p className="mt-4 text-xs text-amber-200">
              Waiting for {drift.minimum_samples} baseline and current samples
              ({drift.current_samples ?? 0} current, {drift.baseline_samples ?? 0} baseline).
            </p>
          )}
          <button onClick={() => run('drift', evaluateMLOpsDrift, 'Drift evaluation completed')} className="mt-5 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-medium text-black hover:bg-white disabled:opacity-50" disabled={!!busy}>
            <ShieldAlert size={15} className="mr-2 inline" /> Evaluate drift
          </button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="font-medium text-white">Model lifecycle</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">Champion</span><span className="text-white">{metrics.current_mlflow_model_version}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">MLflow</span><span className="text-white">{metrics.mlflow_enabled ? 'connected' : 'not configured'}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">DVC</span><span className="text-white">{metrics.dvc_enabled ? 'enabled' : 'not configured'}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Evidently</span><span className="text-white">{metrics.evidently_ready ? 'active' : metrics.evidently_enabled ? 'installed, waiting for data' : 'not installed'}</span></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => run('retrain', retrainMLOps, 'Challenger training completed')} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-50" disabled={!!busy}>Train challenger</button>
            <button onClick={() => run('promote', promoteMLOpsModel, 'Promotion decision completed')} className="rounded-lg bg-violet-300 px-3 py-2 text-sm font-medium text-black hover:bg-white disabled:opacity-50" disabled={!!busy}>Promote challenger</button>
          </div>
        </section>
      </div>

      {message && <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">{message}</div>}
    </div>
  )
}

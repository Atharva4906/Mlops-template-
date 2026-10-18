import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const stages = [
  { title: 'Ingest', text: 'Email, chat, webhook, and simulator messages enter one ticket stream.' },
  { title: 'Protect', text: 'Sensitive customer information is scrubbed before processing.' },
  { title: 'Understand', text: 'The routing agent identifies intent, sentiment, urgency, and confidence.' },
  { title: 'Route', text: 'Each ticket is assigned to the appropriate specialist queue.' },
  { title: 'Learn', text: 'Resolution feedback supports monitoring and future model improvement.' },
]

const capabilities = [
  ['Multi-channel ingestion', 'Email, chat, webhook, and manual ticket intake'],
  ['Hybrid agentic routing', 'Deterministic signals, retrieval, classification, and human fallback'],
  ['Specialist queues', 'Domain-based ownership for faster ticket resolution'],
  ['Operational visibility', 'Ticket timeline, queue views, escalation handling, and audit context'],
  ['MLOps lifecycle', 'Drift monitoring, retraining, model promotion, MLflow, and local DVC'],
  ['Production delivery', 'Automated tests, frontend builds, and container publishing through CI/CD'],
]

const sources = ['Email', 'Chat', 'Webhook', 'Simulator']

const marquee = [
  'PII scrubbing', 'Intent detection', 'Sentiment analysis', 'Urgency scoring', 'Confidence calibration',
  'Specialist queues', 'Human fallback', 'Drift monitoring', 'Retraining', 'Model promotion', 'MLflow', 'DVC', 'CI/CD',
]

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

const FX_CSS = `
@keyframes dp-word { from { opacity: 0; transform: translateY(26px); filter: blur(12px) } to { opacity: 1; transform: none; filter: blur(0) } }
@keyframes dp-fade-up { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
@keyframes dp-drift-a { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(70px,50px) scale(1.15) } }
@keyframes dp-drift-b { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(-60px,-40px) scale(1.12) } }
@keyframes dp-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
@keyframes dp-swap { from { opacity: 0; transform: translateY(10px); filter: blur(6px) } to { opacity: 1; transform: none; filter: blur(0) } }
@keyframes dp-marq { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@keyframes dp-ring { 0% { box-shadow: 0 0 0 0 rgba(0,113,227,.45) } 100% { box-shadow: 0 0 0 14px rgba(0,113,227,0) } }
@keyframes dp-shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
@keyframes dp-line { from { transform: scaleX(0) } to { transform: scaleX(1) } }

.dp-word { display: inline-block; margin-right: .26em; opacity: 0; animation: dp-word .9s cubic-bezier(.2,.8,.2,1) forwards }
.dp-hero-fade { opacity: 0; animation: dp-fade-up .8s cubic-bezier(.2,.8,.2,1) forwards }
.dp-blob-a { animation: dp-drift-a 18s ease-in-out infinite }
.dp-blob-b { animation: dp-drift-b 23s ease-in-out infinite }
.dp-float { animation: dp-float 4.5s ease-in-out infinite }
.dp-swap { display: inline-block; animation: dp-swap .55s cubic-bezier(.2,.8,.2,1) both }

.dp-reveal { opacity: 0; transform: translateY(30px) scale(.98); filter: blur(6px);
  transition: opacity .8s cubic-bezier(.2,.8,.2,1), transform .8s cubic-bezier(.2,.8,.2,1), filter .8s cubic-bezier(.2,.8,.2,1) }
.dp-reveal.dp-in { opacity: 1; transform: none; filter: blur(0) }

.dp-tilt { position: relative; transform: perspective(900px) translateY(var(--ty, 0px)) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transition: transform .3s cubic-bezier(.2,.8,.2,1), box-shadow .3s ease, background-color .3s ease; will-change: transform }
.dp-tilt::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0; transition: opacity .3s;
  background: radial-gradient(240px circle at var(--gx, 50%) var(--gy, 50%), rgba(0,113,227,.12), transparent 70%) }
.dp-tilt:hover::after { opacity: 1 }

.dp-node { transition: transform .4s cubic-bezier(.2,.8,.2,1), background .4s ease, color .4s ease, box-shadow .4s ease }
.dp-node-active { animation: dp-ring 1.6s ease-out infinite }

.dp-row { position: relative; transition: transform .3s cubic-bezier(.2,.8,.2,1) }
.dp-row::before { content: ''; position: absolute; left: -14px; top: 4px; bottom: 16px; width: 3px; border-radius: 3px;
  background: linear-gradient(180deg, #3aa0ff, #0071e3); transform: scaleY(0); transform-origin: top; transition: transform .35s cubic-bezier(.2,.8,.2,1) }
.dp-row:hover { transform: translateX(8px) }
.dp-row:hover::before { transform: scaleY(1) }

.dp-marquee { -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent) }
.dp-marquee-track { display: flex; width: max-content; animation: dp-marq 45s linear infinite }
.dp-marquee:hover .dp-marquee-track { animation-play-state: paused }

.dp-title-line { display: block; height: 3px; width: 56px; border-radius: 3px; background: linear-gradient(90deg, #3aa0ff, #0071e3); transform-origin: left; transform: scaleX(0) }
.dp-in .dp-title-line { animation: dp-line .8s .25s cubic-bezier(.2,.8,.2,1) forwards }

.dp-foot { background-size: 200% 100%; background-image: linear-gradient(100deg, rgba(245,245,247,.9) 30%, rgba(255,255,255,1) 50%, rgba(245,245,247,.9) 70%); animation: dp-shimmer 7s linear infinite }

.dp-hl { position: relative; display: inline-block; z-index: 0 }
.dp-hl::after { content: ''; position: absolute; left: -2%; right: -2%; bottom: 4%; height: 34%; z-index: -1; border-radius: 6px;
  background: linear-gradient(90deg, rgba(58,160,255,.38), rgba(0,113,227,.28)); transform: scaleX(0); transform-origin: left;
  animation: dp-line 1s 1s cubic-bezier(.2,.8,.2,1) forwards }
.dp-seg-ind { transition: transform .35s cubic-bezier(.2,.8,.2,1) }
.dp-search { transition: box-shadow .3s ease, transform .3s ease }
.dp-search:focus-within { box-shadow: 0 0 0 4px rgba(0,113,227,.14), 0 18px 50px rgba(0,113,227,.16); transform: translateY(-2px) }
.dp-caret::after { content: ''; display: inline-block; width: 1px; height: 1em; margin-left: 2px; vertical-align: -2px; background: #a1a1aa; animation: dp-blink 1s steps(1) infinite }
@keyframes dp-blink { 50% { opacity: 0 } }

@media (prefers-reduced-motion: reduce) {
  .dp-hl::after { transform: none; animation: none }
  .dp-caret::after { animation: none }
  .dp-word, .dp-hero-fade { opacity: 1; animation: none }
  .dp-blob-a, .dp-blob-b, .dp-float, .dp-swap, .dp-marquee-track, .dp-node-active, .dp-foot { animation: none }
  .dp-reveal { opacity: 1; transform: none; filter: none; transition: none }
  .dp-title-line { transform: none; animation: none }
  .dp-tilt, .dp-row { transition: none }
}
`

/* ───────── hooks & small building blocks ───────── */

function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setSeen(true); io.disconnect() }
    }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, seen]
}

function Reveal({ children, delay = 0, className = '' }) {
  const [ref, seen] = useInView()
  return (
    <div ref={ref} className={`dp-reveal ${seen ? 'dp-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

function CountUp({ to }) {
  const [ref, seen] = useInView(0.4)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!seen) return
    let raf, start
    const dur = 1300
    const tick = t => {
      if (!start) start = t
      const p = Math.min((t - start) / dur, 1)
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seen, to])
  return <span ref={ref}>{n}</span>
}

function TiltCard({ children, className = '', style, max = 7, onEnter }) {
  const ref = useRef(null)
  const onMove = e => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.setProperty('--rx', `${((0.5 - py) * max).toFixed(2)}deg`)
    el.style.setProperty('--ry', `${((px - 0.5) * max).toFixed(2)}deg`)
    el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`)
    el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`)
  }
  const onLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }
  return (
    <div ref={ref} onMouseMove={onMove} onMouseEnter={onEnter} onMouseLeave={onLeave} className={`dp-tilt ${className}`} style={style}>
      {children}
    </div>
  )
}

/* ───────── sections ───────── */

const examples = ['Show system telemetry', "What's in the queue?", 'List projects', 'Show me the daily AI digest', "What's on my calendar?"]

/* Types example queries into the search placeholder while the box is empty */
function useTypewriter(active) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (!active) { setText(''); return }
    let i = 0, pos = 0, dir = 1, timer
    const tick = () => {
      const word = examples[i]
      pos += dir
      setText(word.slice(0, pos))
      let delay = dir === 1 ? 70 : 32
      if (dir === 1 && pos === word.length) { dir = -1; delay = 1500 }
      else if (dir === -1 && pos === 0) { dir = 1; i = (i + 1) % examples.length; delay = 420 }
      timer = setTimeout(tick, delay)
    }
    timer = setTimeout(tick, 600)
    return () => clearTimeout(timer)
  }, [active])
  return text
}

function Hero() {
  const ref = useRef(null)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('quick')
  const typed = useTypewriter(query === '')

  const onMove = e => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`)
    el.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`)
  }

  const submit = e => {
    e.preventDefault()
    const q = query.trim()
    navigate('/assistant', q ? { state: { query: q, mode } } : undefined)
  }

  const gridLines = (color) => `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`

  return (
    <section
      ref={ref}
      onMouseMove={onMove}
      className="relative overflow-hidden rounded-[32px] bg-white ring-1 ring-black/[0.06] shadow-[0_20px_60px_rgba(15,23,42,0.08)] min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-5 py-16 text-center"
    >
      {/* base grid */}
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: gridLines('rgba(0,0,0,0.045)'), backgroundSize: '40px 40px' }} />
      {/* grid that lights up around the cursor */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: gridLines('rgba(0,113,227,0.28)'),
          backgroundSize: '40px 40px',
          WebkitMaskImage: 'radial-gradient(240px circle at var(--mx, 50%) var(--my, 40%), #000 0%, transparent 70%)',
          maskImage: 'radial-gradient(240px circle at var(--mx, 50%) var(--my, 40%), #000 0%, transparent 70%)',
        }}
      />
      {/* drifting glows */}
      <div className="dp-blob-a pointer-events-none absolute -top-28 left-[8%] h-80 w-80 rounded-full bg-sky-300/30 blur-3xl" />
      <div className="dp-blob-b pointer-events-none absolute -bottom-32 right-[6%] h-96 w-96 rounded-full bg-violet-300/25 blur-3xl" />
      {/* soft vignette so text stays crisp */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 65%)' }} />

      <div className="relative w-full max-w-[880px]">
        {/* badge */}
        <div className="dp-hero-fade inline-flex items-center rounded-full bg-white/90 px-5 py-2 text-[13px] font-semibold text-zinc-700 ring-1 ring-black/[0.08] shadow-sm backdrop-blur" style={{ animationDelay: '60ms' }}>
          {stages.length} pipeline stages across {sources.length} intake sources
        </div>

        {/* headline */}
        <h1 className="mt-7 text-[clamp(42px,8vw,96px)] font-extrabold leading-[0.98] tracking-[-0.035em] text-zinc-900">
          {['Route', 'every', 'ticket'].map((w, i) => (
            <span key={w} className="dp-word" style={{ animationDelay: `${160 + i * 120}ms` }}>{w}</span>
          ))}
          <br />
          {['to', 'the'].map((w, i) => (
            <span key={w} className="dp-word" style={{ animationDelay: `${520 + i * 120}ms` }}>{w}</span>
          ))}
          <span className="dp-word" style={{ animationDelay: '760ms' }}>
            <span className="dp-hl">right specialist</span>
          </span>
        </h1>

        <p className="dp-hero-fade mx-auto mt-7 max-w-[640px] text-[clamp(15px,1.6vw,19px)] leading-[1.7] text-zinc-500" style={{ animationDelay: '900ms' }}>
          A multi-channel support platform that turns incoming customer requests into safe, explainable, and actionable specialist tickets.
        </p>

        {/* search */}
        <form
          onSubmit={submit}
          className="dp-hero-fade dp-search mx-auto mt-10 flex w-full max-w-[760px] items-center gap-2 rounded-2xl bg-white p-2 pl-5 ring-1 ring-black/[0.1] shadow-[0_10px_40px_rgba(0,0,0,0.08)]"
          style={{ animationDelay: '1050ms' }}
        >
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={typed || 'Ask the assistant'}
            aria-label="Ask the assistant"
            className="min-w-0 flex-1 bg-transparent py-3 text-[16px] text-zinc-900 outline-none placeholder:text-zinc-400"
          />

          {/* Quick / Deep toggle (visual) */}
          <div className="relative hidden sm:grid grid-cols-2 rounded-xl bg-[#f5f5f7] p-1 text-[13px] font-medium ring-1 ring-black/[0.05]" role="tablist" aria-label="Search depth">
            <span
              className="dp-seg-ind absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
              style={{ transform: mode === 'quick' ? 'translateX(0)' : 'translateX(100%)' }}
            />
            {['quick', 'deep'].map(m => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`relative z-10 rounded-lg px-4 py-2 capitalize transition-colors cursor-pointer ${mode === m ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'}`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            type="submit"
            className="shrink-0 rounded-xl px-6 py-3 text-[14px] font-semibold text-white shadow-[0_4px_14px_rgba(0,113,227,0.35)] hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,113,227,0.45)] active:scale-95 transition-all duration-200 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }}
          >
            Ask
          </button>
        </form>

        {/* hint */}
        <p className="dp-hero-fade mt-5 text-[13px] text-zinc-400" style={{ animationDelay: '1200ms' }}>
          Try{' '}
          <button type="button" onClick={() => setQuery('show telemetry')} className="text-zinc-500 underline decoration-dotted underline-offset-4 hover:text-[#0071e3] cursor-pointer">"show telemetry"</button>
          {' '}or{' '}
          <button type="button" onClick={() => setQuery("what's in the queue?")} className="text-zinc-500 underline decoration-dotted underline-offset-4 hover:text-[#0071e3] cursor-pointer">"what's in the queue?"</button>
        </p>

        {/* secondary buttons */}
        <div className="dp-hero-fade mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '1320ms' }}>
          <button
            onClick={() => navigate('/assistant')}
            className="rounded-xl bg-white px-5 py-2.5 text-[14px] font-semibold text-zinc-800 ring-1 ring-black/[0.1] shadow-sm hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.10)] active:scale-95 transition-all duration-200 cursor-pointer"
          >
            Open assistant
          </button>
          <button
            onClick={() => navigate('/inbox')}
            className="rounded-xl bg-white px-5 py-2.5 text-[14px] font-semibold text-zinc-800 ring-1 ring-black/[0.1] shadow-sm hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.10)] active:scale-95 transition-all duration-200 cursor-pointer"
          >
            Browse queue
          </button>
        </div>
      </div>
    </section>
  )
}

function Stats() {
  const items = [
    { value: sources.length, label: 'Intake sources' },
    { value: stages.length, label: 'Pipeline stages' },
    { value: capabilities.length, label: 'Platform capabilities' },
  ]
  return (
    <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
      {items.map((s, i) => (
        <Reveal key={s.label} delay={i * 110}>
          <div className="rounded-3xl bg-[#f5f5f7] px-5 py-5 text-center ring-1 ring-black/[0.04] transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_14px_36px_rgba(0,0,0,0.09)]">
            <div className="text-[clamp(30px,5vw,46px)] font-semibold leading-none tracking-tight text-zinc-900">
              <CountUp to={s.value} />
            </div>
            <div className="mt-2 text-[12px] font-medium text-zinc-500">{s.label}</div>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

function MarqueeStrip() {
  const row = [...marquee, ...marquee]
  return (
    <div className="dp-marquee mt-8 overflow-hidden py-1">
      <div className="dp-marquee-track">
        {row.map((item, i) => (
          <span key={i} className="mx-1.5 whitespace-nowrap rounded-full bg-[#f5f5f7] px-4 py-1.5 text-[13px] font-medium text-zinc-600 ring-1 ring-black/[0.04]">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function Pipeline() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setActive(i => (i + 1) % stages.length), 2000)
    return () => clearInterval(id)
  }, [paused])

  const pct = (active / (stages.length - 1)) * 100

  return (
    <div onMouseLeave={() => setPaused(false)}>
      {/* animated progress track with numbered nodes (desktop) */}
      <div className="relative mb-6 hidden md:block">
        <div className="absolute left-[10%] right-[10%] top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-black/[0.08]">
          <div
            className="relative h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #3aa0ff, #0071e3)' }}
          >
            <span className="absolute -right-1 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#0071e3] shadow-[0_0_14px_4px_rgba(0,113,227,0.55)]" />
          </div>
        </div>
        <div className="relative grid grid-cols-5">
          {stages.map((s, i) => {
            const done = i < active
            const on = i === active
            return (
              <div key={s.title} className="flex justify-center">
                <button
                  onClick={() => { setActive(i); setPaused(true) }}
                  className={`dp-node flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-semibold ${on ? 'dp-node-active scale-110 text-white' : done ? 'bg-[#e6f1ff] text-[#0071e3]' : 'bg-white text-zinc-400 ring-1 ring-black/[0.1]'}`}
                  style={on ? { background: 'linear-gradient(135deg, #3aa0ff, #0071e3)' } : undefined}
                  aria-label={`Stage ${i + 1}: ${s.title}`}
                >
                  {i + 1}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {stages.map((s, i) => {
          const on = i === active
          return (
            <Reveal key={s.title} delay={i * 90}>
              <TiltCard
                max={8}
                className={`h-full rounded-3xl p-5 ring-1 ${on ? 'bg-white ring-[#0071e3]/40 shadow-[0_18px_44px_rgba(0,113,227,0.20)]' : 'bg-white ring-black/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.05)]'}`}
                style={{ '--ty': on ? '-8px' : '0px' }}
                onEnter={() => { setActive(i); setPaused(true) }}
              >
                <div className={`mb-4 text-center text-[13px] font-semibold tracking-wide transition-colors duration-300 ${on ? 'text-[#0071e3]' : 'text-zinc-400'}`}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="text-center text-[16px] font-semibold text-zinc-900">{s.title}</div>
                <p className="mt-2 text-center text-[12px] leading-5 text-zinc-500">{s.text}</p>
              </TiltCard>
            </Reveal>
          )
        })}
      </div>
    </div>
  )
}

/* ───────── page ───────── */

export default function TicketRoutingDashboard() {
  return (
    <div className="min-h-screen pb-24 text-zinc-900" style={{ fontFamily: FONT }}>
      <style>{FX_CSS}</style>

      <Hero />
      <Stats />
      <MarqueeStrip />

      <section className="mt-12">
        <Reveal className="mb-10 text-center">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[#0071e3]">How the system works</div>
          <h2 className="mx-auto mt-2 max-w-3xl text-[clamp(26px,4vw,40px)] font-semibold tracking-tight">From customer message to specialist ownership</h2>
          <span className="dp-title-line mx-auto mt-5" style={{ transformOrigin: 'center' }} />
        </Reveal>
        <Pipeline />
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal>
          <TiltCard max={3} className="h-full rounded-3xl bg-white p-7 text-center ring-1 ring-black/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[#0071e3]">Product purpose</div>
            <h2 className="mt-2 text-2xl font-semibold">Built for support operations teams</h2>
            <p className="mx-auto mt-4 max-w-xl text-[14px] leading-7 text-zinc-500">
              The platform reduces manual triage by classifying incoming requests, sending them to the right queue, and preserving the context needed by support agents. Operators retain control through escalation, reassignment, status updates, and feedback loops.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3 text-center">
              {['Faster first assignment', 'Consistent routing decisions', 'Observable model behavior'].map((item, i) => (
                <div
                  key={item}
                  className="rounded-2xl bg-[#f5f5f7] p-4 text-[13px] font-medium text-zinc-700 transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_10px_26px_rgba(0,0,0,0.09)]"
                  style={{ transitionDelay: '0ms' }}
                >
                  {item}
                </div>
              ))}
            </div>
          </TiltCard>
        </Reveal>

        <Reveal delay={120}>
          <div className="h-full rounded-3xl bg-[#f5f5f7] p-7 ring-1 ring-black/[0.04]">
            <div className="text-center text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Platform scope</div>
            <div className="mt-5 space-y-4 pl-3">
              {capabilities.map(([title, text], i) => (
                <Reveal key={title} delay={160 + i * 80}>
                  <div className="dp-row border-b border-black/[0.07] pb-4 last:border-0 last:pb-0">
                    <div className="text-[14px] font-semibold">{title}</div>
                    <div className="mt-1 text-[12px] leading-5 text-zinc-500">{text}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <Reveal className="mt-12">
        <footer className="dp-foot mx-auto max-w-3xl rounded-3xl border border-black/[0.06] px-6 py-5 text-center text-[13px] leading-6 text-zinc-600">
          This is the project display page. Use the navigation for live ticket operations, ingestion, queue management, timeline views, metrics, and the MLOps lifecycle.
        </footer>
      </Reveal>
    </div>
  )
}
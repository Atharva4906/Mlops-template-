import { useEffect, useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { createTicket, getEmails, processEmail } from '../services/api'

// Formatting helpers
const FT = iso => {
  try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso || '' }
}

const shortDate = iso => {
  try { 
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
  }
  catch { return '' }
}

const initials = (sender = '') => {
  const name = sender.split('@')[0]
  return name.slice(0, 2).toUpperCase() || 'EX'
}

// Function to safely turn plain text URLs into clickable blue links
const formatPlainText = (text) => {
  if (!text) return ''
  
  // 1. Remove angle brackets around URLs that some automated systems use (e.g., <https://...>)
  const cleanedText = text.replace(/<(https?:\/\/[^>]+)>/g, '$1')

  // 2. Regex to find standard URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = cleanedText.split(urlRegex)

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a 
          key={index} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[#0071e3] hover:underline break-all"
          onClick={e => e.stopPropagation()}
        >
          {part}
        </a>
      )
    }
    return <span key={index}>{part}</span>
  })
}

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

const FX_CSS = `
@keyframes ib-rise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
@keyframes ib-open { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: none } }
.ib-rise { animation: ib-rise .55s cubic-bezier(.2,.8,.2,1) both }
.ib-open { animation: ib-open .3s cubic-bezier(.2,.8,.2,1) both }
@media (prefers-reduced-motion: reduce) { .ib-rise, .ib-open { animation: none !important } }
`

// Checkbox drawn with CSS (no icon library)
function Box({ checked, partial }) {
  const on = checked || partial
  return (
    <div className={`w-[18px] h-[18px] rounded-[6px] flex items-center justify-center transition-all duration-150 ${on ? 'bg-[#0071e3] ring-1 ring-[#0071e3]' : 'bg-white ring-1 ring-zinc-300'}`}>
      {checked && <span className="block w-[5px] h-[9px] border-white border-r-2 border-b-2 rotate-45 -mt-[2px]" />}
      {partial && !checked && <span className="block w-[10px] h-[2px] bg-white rounded" />}
    </div>
  )
}

function EmailRow({ email, isSelected, onSelect, onClick, isOpen, onProcess, onRoute }) {
  const [routing, setRouting] = useState(false)
  const iframeRef = useRef(null)

  const senderName = (email.sender || '').split('@')[0] || 'Unknown'
  const ini = initials(email.sender)

  const handleRoute = async (e) => {
    e.stopPropagation()
    setRouting(true)
    await onRoute(email)
    setRouting(false)
  }

  // Smarter HTML Detection
  const bodyContent = email.body || email.snippet || '(empty)'
  const isHtml = /<html|<body|<div|<table|<p>/i.test(bodyContent)

  const rowBg = isSelected ? 'bg-[#c2e7ff]/40' : isOpen ? 'bg-[#f2f6fc]' : 'bg-white'
  const textWeight = isOpen ? 'font-normal text-zinc-500' : 'font-semibold text-zinc-900'

  // Securely inject a script to force the iframe to report its true height
  const getSecureHtml = (html) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_blank">
          <style>
            body { margin: 0; padding: 16px; font-family: Arial, sans-serif; word-wrap: break-word; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          ${html}
          <script>
            const updateHeight = () => {
              const height = document.documentElement.scrollHeight;
              window.parent.postMessage({ type: 'resize-iframe', height: height, id: '${email.id}' }, '*');
            };
            window.onload = updateHeight;
            new ResizeObserver(updateHeight).observe(document.body);
          </script>
        </body>
      </html>
    `
  }

  useEffect(() => {
    // Listen for resize messages from the iframe to prevent white/empty screens
    const handleMessage = (e) => {
      if (e.data.type === 'resize-iframe' && e.data.id === email.id && iframeRef.current) {
        iframeRef.current.style.height = `${e.data.height}px`;
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [email.id])

  return (
    <div className="flex flex-col relative border-b border-black/[0.06] last:border-b-0">
      {/* LIST ROW */}
      <div
        className={`group/row relative flex items-center h-[44px] cursor-pointer ${rowBg} hover:z-10 hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] transition-shadow duration-150 px-4`}
        onClick={onClick}
      >
        <div className="flex items-center gap-2 w-[48px] shrink-0" onClick={e => e.stopPropagation()}>
          <div 
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/[0.05] cursor-pointer transition-colors"
            onClick={() => onSelect(email.id)}
          >
            <Box checked={isSelected} />
          </div>
        </div>

        <div className="w-[168px] shrink-0 pr-8">
          <span className={`text-[14px] truncate block ${textWeight}`}>
            {senderName}
          </span>
        </div>

        <div className="flex-1 min-w-0 flex items-center overflow-hidden text-[14px] whitespace-nowrap">
          <span className={`truncate ${textWeight}`}>
            {email.subject || '(no subject)'}
          </span>
          <span className="text-zinc-300 mx-1.5">-</span>
          <span className="text-zinc-400 truncate">
            {email.snippet || ''}
          </span>
        </div>

        <div className="relative w-[96px] shrink-0 text-right h-full flex items-center justify-end">
          <span className={`text-[12px] transition-opacity duration-100 group-hover/row:opacity-0 ${isOpen ? 'text-zinc-400' : 'text-zinc-700 font-semibold'}`}>
            {shortDate(email.received_at || email.date)}
          </span>
          <button
            onClick={handleRoute}
            disabled={routing || email.ticket_id}
            className="absolute right-0 opacity-0 group-hover/row:opacity-100 px-3 py-1 rounded-full bg-white ring-1 ring-black/[0.1] text-[12px] font-medium text-[#0b57d0] hover:bg-[#e8f0fe] transition-all disabled:text-zinc-400 disabled:hover:bg-white"
          >
            {routing ? 'Routing…' : (email.ticket_id ? 'Routed' : 'Route')}
          </button>
        </div>
      </div>

      {/* READING PANE (EXPANDED) */}
      {isOpen && (
        <div className="ib-open bg-[#f5f5f7] text-zinc-900 border-t border-black/[0.06] p-6 pb-10">
          <div className="max-w-4xl mx-auto lg:ml-[72px]">
            
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[24px] font-semibold tracking-tight text-zinc-900 leading-8">
                {email.subject || '(no subject)'}
                <span className="bg-white ring-1 ring-black/[0.06] text-zinc-500 text-[11px] px-2.5 py-0.5 rounded-full ml-3 align-middle font-medium">Inbox</span>
              </h2>
            </div>

            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-semibold shrink-0 shadow-[0_4px_12px_rgba(0,113,227,0.3)]"
                  style={{ background: 'linear-gradient(135deg, #3aa0ff, #0071e3)' }}
                >
                  {ini}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[14px] text-zinc-900">{senderName}</span>
                    <span className="text-[12px] text-zinc-500">&lt;{email.sender}&gt;</span>
                  </div>
                  <span className="text-[12px] text-zinc-400 mt-0.5">
                    to me
                  </span>
                </div>
              </div>
              <div className="text-zinc-500 text-[12px]">
                {FT(email.received_at || email.date)}
              </div>
            </div>

            {/* SAFE EMAIL BODY RENDERER */}
            <div className="mb-10 overflow-hidden">
              {isHtml ? (
                <div className="bg-white rounded-2xl overflow-hidden ring-1 ring-black/[0.06] shadow-[0_6px_24px_rgba(0,0,0,0.06)]">
                  <iframe
                    ref={iframeRef}
                    srcDoc={getSecureHtml(bodyContent)}
                    title="Email Body"
                    sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-scripts"
                    className="w-full min-h-[200px] border-none bg-white transition-all duration-300"
                    scrolling="no"
                  />
                </div>
              ) : (
                <div className="bg-white ring-1 ring-black/[0.06] shadow-[0_6px_24px_rgba(0,0,0,0.05)] rounded-2xl p-6">
                  <div className="text-[14px] text-zinc-800 leading-[1.65rem] whitespace-pre-wrap break-words">
                    {formatPlainText(bodyContent)}
                  </div>
                </div>
              )}
            </div>

            {/* API ACTION CARDS */}
            <div className="pt-2 flex flex-col md:flex-row gap-4">
              <div className="flex-1 bg-white ring-1 ring-black/[0.06] shadow-[0_6px_24px_rgba(0,0,0,0.05)] rounded-2xl p-5 flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.09)]">
                <div className="text-zinc-900 text-[15px] font-semibold mb-1.5">Ticket routing</div>
                <p className="text-[13px] text-zinc-500 mb-5 leading-relaxed">Send this fetched email through PII scrubbing, intent detection, and specialist queue routing.</p>
                <button
                  onClick={handleRoute}
                  disabled={routing || email.ticket_id}
                  className="mt-auto self-start px-5 py-2.5 rounded-full text-white text-[14px] font-medium shadow-[0_4px_14px_rgba(0,113,227,0.35)] hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,113,227,0.45)] active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }}
                >
                  {routing ? 'Routing…' : (email.ticket_id ? 'Already routed' : 'Route email to ticket queue')}
                </button>
              </div>

              <div className="md:w-[280px] bg-white ring-1 ring-black/[0.06] shadow-[0_6px_24px_rgba(0,0,0,0.05)] rounded-2xl p-5 flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.09)]">
                <div className="text-zinc-900 text-[15px] font-semibold mb-1.5">
                  LangGraph Agent
                </div>
                <p className="text-[13px] text-zinc-500 mb-5 leading-relaxed">
                  Process this email through the automated AI pipeline.
                </p>
                <button
                  onClick={() => onProcess(email.id)}
                  className="mt-auto self-start px-5 py-2.5 rounded-full bg-[#f5f5f7] hover:bg-[#ebebef] text-zinc-800 text-[14px] font-medium active:scale-95 transition-all duration-200"
                >
                  Process Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Inbox() {
  const { state, dispatch, toast, addLog } = useApp() || {}
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [clusterModal, setClusterModal] = useState(false)
  const [clusterName, setClusterName] = useState('')
  const clusterRef = useRef(null)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')

  useEffect(() => {
    loadEmails()
  }, [])

  const loadEmails = async () => {
    setLoading(true)
    addLog?.('info', 'Fetching real Gmail inbox...')
    try {
      const d = await getEmails(10)
      if (d.error) { toast?.(d.error, 'warn'); addLog?.('error', d.error); setLoading(false); return }
      dispatch?.({ type: 'SET_EMAILS', emails: d.emails || [] })
      addLog?.('ok', `${(d.emails || []).length} emails fetched`)
    } catch { toast?.('Backend not running', 'warn') }
    setLoading(false)
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    const list = visibleEmails;
    if (list.length > 0 && list.every(e => selectedIds.has(e.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(list.map(e => e.id)));
    }
  }

  /* const handleCluster = async () => {
    if (!clusterName.trim() || !selectedIds.size) return
    try {
      const r = await clusterManual(Array.from(selectedIds), clusterName.trim())
      if (r.error) { toast?.(r.error, 'warn'); return }
      toast?.(`Clustered ${selectedIds.size} emails into "${clusterName.trim()}"`, 'ok')
      setSelectedIds(new Set())
      setClusterModal(false)
      setClusterName('')
    } catch { toast?.('Cluster failed', 'warn') }
  } */

  const handleRoute = async (email) => {
    try {
      const res = await createTicket({
        id: email.id,
        email_id: email.id,
        thread_id: email.thread_id || email.threadId || null,
        channel: 'email',
        subject: email.subject || '',
        content: email.body || email.snippet || '(empty)',
      })
      if (res.error) throw new Error(res.error)
      toast?.('Email routed to ticket queue', 'ok')
      addLog?.('ok', `Email ${email.id} → ticket queue`)
      dispatch?.({ type: 'SET_EMAILS', emails: (state?.emails || []).map(e => e.id === email.id ? { ...e, ticket_id: res.ticket.id } : e) })
    } catch (e) { toast?.(e.message || 'Email routing failed', 'warn') }
  }

  const handleProcess = async (id) => {
    try { await processEmail(id); toast?.('Processing triggered', 'ok'); addLog?.('info', `Manual trigger: ${id}`) }
    catch { toast?.('Failed', 'warn') }
  }

  const emails = state?.emails || []
  const q = query.trim().toLowerCase()
  const visibleEmails = emails.filter(e => {
    if (tab === 'routed' && !e.ticket_id) return false
    if (tab === 'pending' && e.ticket_id) return false
    if (!q) return true
    return [e.sender, e.subject, e.snippet].some(v => (v || '').toLowerCase().includes(q))
  })
  const routedCount = emails.filter(e => e.ticket_id).length
  const hasSelected = selectedIds.size > 0
  const allSelected = visibleEmails.length > 0 && visibleEmails.every(e => selectedIds.has(e.id))
  const TABS = [
    { id: 'all', label: 'All', count: emails.length },
    { id: 'pending', label: 'Not routed', count: emails.length - routedCount },
    { id: 'routed', label: 'Routed', count: routedCount },
  ]

  return (
    <div className="w-full text-zinc-900 flex flex-col pb-10" style={{ fontFamily: FONT }}>
      <style>{FX_CSS}</style>

      <div className="ib-rise flex items-end justify-between pb-6">
        <div>
          <h1
            className="text-[34px] font-semibold tracking-tight leading-none bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #4a4a58 100%)' }}
          >
            Inbox
          </h1>
          <p className="text-[13px] text-zinc-500 mt-2">Fetched emails, ready to route into specialist queues</p>
        </div>
      </div>

      <div className="ib-rise flex-1 flex flex-col w-full" style={{ animationDelay: '90ms' }}>
        <div className="bg-white rounded-3xl ring-1 ring-black/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.07)] flex-1 flex flex-col overflow-hidden">
          
          {/* macOS-style window controls (decorative only) */}
          <div className="group/win relative h-[40px] flex items-center px-4 bg-[#f5f5f7] border-b border-black/[0.06] select-none" aria-hidden="true">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ff5f57] ring-1 ring-black/10 flex items-center justify-center text-[9px] leading-none font-bold text-black/50">
                <span className="opacity-0 group-hover/win:opacity-100 transition-opacity">×</span>
              </span>
              <span className="w-3 h-3 rounded-full bg-[#febc2e] ring-1 ring-black/10 flex items-center justify-center text-[11px] leading-none font-bold text-black/50">
                <span className="opacity-0 group-hover/win:opacity-100 transition-opacity -mt-[1px]">−</span>
              </span>
              <span className="w-3 h-3 rounded-full bg-[#28c840] ring-1 ring-black/10 flex items-center justify-center text-[10px] leading-none font-bold text-black/50">
                <span className="opacity-0 group-hover/win:opacity-100 transition-opacity">+</span>
              </span>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 text-[12px] font-medium text-zinc-500">Inbox</div>
          </div>

          {/* Gmail-style search */}
          <div className="px-4 py-3 bg-white border-b border-black/[0.06]">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search mail"
              className="w-full max-w-[640px] bg-[#eaf1fb] text-zinc-900 placeholder:text-zinc-500 px-5 py-2.5 rounded-full text-[14px] outline-none focus:bg-white focus:shadow-[0_1px_1px_0_rgba(65,69,73,0.3),0_1px_3px_1px_rgba(65,69,73,0.15)] transition-all duration-200"
            />
          </div>

          {/* Gmail-style category tabs */}
          <div className="flex items-stretch border-b border-black/[0.08] bg-white px-2 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-5 h-[46px] text-[14px] font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'text-[#0b57d0]' : 'text-zinc-500 hover:bg-[#f5f5f7]'}`}
              >
                {t.label}
                <span className={`ml-2 text-[12px] ${tab === t.id ? 'text-[#0b57d0]' : 'text-zinc-400'}`}>{t.count}</span>
                {tab === t.id && <span className="absolute left-3 right-3 bottom-0 h-[3px] rounded-t-full bg-[#0b57d0]" />}
              </button>
            ))}
          </div>

          <div className="h-[56px] border-b border-black/[0.06] flex items-center px-4 justify-between bg-[#fafafc]">
            <div className="flex items-center gap-2">
              <div 
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/[0.05] cursor-pointer transition-colors"
                onClick={handleSelectAll}
                title="Select all"
              >
                <Box checked={allSelected} partial={!allSelected && selectedIds.size > 0} />
              </div>
              
              <button
                className="px-4 py-1.5 rounded-full bg-white ring-1 ring-black/[0.08] shadow-sm text-[13px] font-medium text-zinc-700 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,0,0,0.10)] active:scale-95 transition-all duration-200"
                onClick={loadEmails}
                title="Refresh emails"
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>

              {hasSelected && (
                <>
                  <div className="w-[1px] h-5 bg-black/[0.1] mx-2" />
                  <span className="text-[12px] font-medium text-[#0071e3]">{selectedIds.size} selected</span>
                </>
              )}
            </div>

            <div className="text-zinc-400 text-[12px] pr-2">
              {emails.length > 0 ? `${visibleEmails.length} of ${emails.length}` : ''}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {visibleEmails.length > 0 ? (
              <div className="flex flex-col pb-4">
                {visibleEmails.map(e => (
                  <EmailRow
                    key={e.id}
                    email={e}
                    isSelected={selectedIds.has(e.id)}
                    onSelect={toggleSelect}
                    onClick={() => setOpenId(openId === e.id ? null : e.id)}
                    isOpen={openId === e.id}
                    onRoute={handleRoute}
                    onProcess={handleProcess}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-zinc-400">
                <span className="text-[15px]">
                  {loading ? 'Fetching emails...' : (emails.length > 0 ? 'No conversations match your search.' : 'Your inbox is empty.')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { scanIngest, getProjects, createProject } from '../../services/api'
import { useApp } from '../../context/AppContext'

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [recentProjects, setRecentProjects] = useState([])
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const inputRef = useRef(null)
  const newProjRef = useRef(null)
  const navigate = useNavigate()
  const { toast = () => {} } = useApp() || {}

  /* ─── Open/close via global event or Cmd+K ─── */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    const onEvent = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('nexus:openPalette', onEvent)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('nexus:openPalette', onEvent)
    }
  }, [])

  /* ─── Focus input when opened ─── */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setActiveIdx(0)
      setCreatingProject(false)
      setNewProjectName('')
    }
  }, [open])

  useEffect(() => {
    if (creatingProject) setTimeout(() => newProjRef.current?.focus(), 50)
  }, [creatingProject])

  /* ─── Build items ─── */
  const STATIC_ITEMS = [
    {
      group: 'Quick Actions',
      items: [
        { label: 'New Project', shortcut: '', action: () => setCreatingProject(true) },
        { label: 'Force Ingest Sync', shortcut: '', action: async () => {
          await scanIngest().catch(() => {}); toast('Ingest triggered', 'ok'); setOpen(false)
        }},
      ]
    },
    {
      group: 'Navigate',
      items: [
        { label: 'Command Center',   shortcut: 'G H', action: () => { navigate('/'); setOpen(false) } },
        { label: 'Project Studio',   shortcut: 'G P', action: () => { navigate('/projects'); setOpen(false) } },
        { label: 'Actions',          shortcut: 'G A', action: () => { navigate('/actions'); setOpen(false) } },
        { label: 'Escalations',      shortcut: 'G E', action: () => { navigate('/escalations'); setOpen(false) } },
        { label: 'Metrics',          shortcut: 'G M', action: () => { navigate('/metrics'); setOpen(false) } },
        { label: 'Inbox',            shortcut: 'G I', action: () => { navigate('/inbox'); setOpen(false) } },
        { label: 'Agent Directives', shortcut: 'G S', action: () => { navigate('/directives'); setOpen(false) } },
      ]
    },
  ]

  useEffect(() => {
    if (open) getProjects().then(d => setRecentProjects((d.projects || []).slice(0, 3))).catch(() => {})
  }, [open])

  const projectItems = recentProjects.map(p => ({
    group: 'Recent Projects',
    label: p.name || 'Unnamed Project',
    shortcut: '',
    action: () => { navigate('/projects'); setOpen(false) },
  }))

  /* Flatten for keyboard navigation */
  const flatItems = [
    ...STATIC_ITEMS.flatMap(g => g.items),
    ...projectItems,
  ]

  /* Filter by query */
  const filtered = query.trim()
    ? flatItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : flatItems

  /* Keyboard navigation */
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' && !creatingProject) {
        e.preventDefault()
        filtered[activeIdx]?.action()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, activeIdx, filtered, creatingProject])

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    try {
      await createProject(newProjectName.trim(), 'Created via Command Palette')
      toast(`Project "${newProjectName.trim()}" created`, 'ok')
      navigate('/projects')
      setOpen(false)
    } catch { toast('Creation failed', 'err') }
  }

  /* Group filtered items for rendering */
  const groupedFiltered = query.trim()
    ? [{ group: 'Results', items: filtered }]
    : [
        ...STATIC_ITEMS.map(g => ({ group: g.group, items: g.items })),
        ...(projectItems.length > 0 ? [{ group: 'Recent Projects', items: projectItems }] : []),
      ]

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[16vh] bg-black/25 backdrop-blur-md"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif' }}
      onClick={() => setOpen(false)}
    >
      <style>{`
        @keyframes cp-in { from { opacity: 0; transform: translateY(-8px) scale(.97) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) { .cp-in { animation: none !important } }
      `}</style>
      <div
        className="cp-in w-full max-w-[600px] mx-4 rounded-3xl overflow-hidden bg-white/90 backdrop-blur-2xl ring-1 ring-black/[0.06] shadow-[0_40px_100px_rgba(0,0,0,0.30)]"
        style={{ animation: 'cp-in .25s cubic-bezier(.2,.8,.2,1) both' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ─── Search bar ─── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-black/[0.07]">
          {creatingProject ? (
            <input
              ref={newProjRef}
              type="text"
              placeholder="Project name"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateProject()
                if (e.key === 'Escape') { setCreatingProject(false); setNewProjectName('') }
              }}
              className="flex-1 bg-transparent outline-none text-[17px] text-zinc-900 placeholder:text-zinc-400"
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a command or search"
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
              className="flex-1 bg-transparent outline-none text-[17px] text-zinc-900 placeholder:text-zinc-400"
            />
          )}
          <button
            onClick={() => setOpen(false)}
            className="shrink-0 text-[11px] font-medium text-zinc-500 bg-[#f5f5f7] hover:bg-[#ebebef] px-2.5 py-1 rounded-full transition-colors cursor-pointer"
          >
            Esc
          </button>
        </div>

        {/* ─── New project inline form ─── */}
        {creatingProject && (
          <div className="px-5 py-3 border-b border-black/[0.07] flex items-center gap-3">
            <span className="text-[13px] font-semibold text-zinc-900">New project</span>
            <div className="flex-1" />
            <button
              onClick={handleCreateProject}
              className="px-4 py-1.5 rounded-full text-[13px] font-medium text-white shadow-[0_4px_12px_rgba(0,113,227,0.35)] hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #3aa0ff, #0071e3)' }}
            >
              Create
            </button>
            <button
              onClick={() => { setCreatingProject(false); setNewProjectName('') }}
              className="text-[13px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ─── Items ─── */}
        <div className="max-h-[380px] overflow-y-auto py-2 px-2">
          {(() => {
            let globalIdx = 0
            return groupedFiltered.map(({ group, items }) => {
              if (!items.length) return null
              return (
                <div key={group} className="mb-1">
                  <div className="px-3 pt-2 pb-1 text-[12px] font-semibold text-zinc-400">
                    {group}
                  </div>
                  {items.map((item) => {
                    const idx = globalIdx++
                    const isActive = activeIdx === idx
                    return (
                      <button
                        key={item.label + idx}
                        onClick={item.action}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors duration-100 cursor-pointer ${isActive ? 'text-white' : 'text-zinc-800'}`}
                        style={{ background: isActive ? 'linear-gradient(135deg, #3aa0ff, #0071e3)' : 'transparent' }}
                      >
                        <span className="text-[14px] font-medium">{item.label}</span>
                        {item.shortcut && (
                          <span className={`text-[11px] shrink-0 ${isActive ? 'text-white/75' : 'text-zinc-400'}`}>{item.shortcut}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          })()}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-[13px] text-zinc-400">
              No results for "{query}"
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="px-5 py-2.5 border-t border-black/[0.07] bg-[#f5f5f7]/70 flex items-center gap-4">
          <span className="text-[11px] text-zinc-400">↑↓ navigate</span>
          <span className="text-[11px] text-zinc-400">↵ select</span>
          <span className="text-[11px] text-zinc-400">esc close</span>
        </div>
      </div>
    </div>
  )
}
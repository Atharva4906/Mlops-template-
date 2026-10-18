import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { login, logout } from '../../services/api'

const NAV_GROUPS = [
  {
    label: 'Core',
    items: [
      { name: 'Command Center', path: '/' },
    ]
  },
  {
    label: 'Ingestion',
    items: [
      { name: 'Email', path: '/email' },
      { name: 'Chat Ingestion', path: '/chat' },
      { name: 'Showcasing', path: '/showcase' },
    ]
  },
  {
    label: 'Ticket Routing',
    items: [
      { name: 'Specialist Queue', path: '/inbox' },
      { name: 'Ticket Simulator', path: '/ticket-simulator' },
      { name: 'Escalations', path: '/escalations' },
      { name: 'Metrics', path: '/metrics' },
      { name: 'MLOps Lifecycle', path: '/mlops' },
      { name: 'Assistant', path: '/assistant' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { name: 'Action Center', path: '/actions' },
      { name: 'Calendar Operations', path: '/calendar' },
    ]
  },
  {
    label: 'System',
    items: [
      { name: 'Ticket Domains', path: '/ticket-domains' },
      { name: 'Agent Directives', path: '/directives' },
    ]
  },
]

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

const SIDEBAR_CSS = `
@keyframes sb-in { from { opacity: 0; transform: translateX(-10px) } to { opacity: 1; transform: none } }
.sb-in { animation: sb-in .45s cubic-bezier(.2,.8,.2,1) both }
@media (prefers-reduced-motion: reduce) { .sb-in { animation: none !important } }
`

export default function Sidebar({ mobileOpen, onClose }) {
  const { state, dispatch } = useApp()
  const location = useLocation()

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      dispatch({ type: 'SET_AUTH', authenticated: false, email: '' })
    }
  }

  return (
    <>
      {/* Backdrop: click anywhere outside the drawer to close it */}
      <div
        className={`fixed inset-0 z-[4998] bg-black/25 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in drawer */}
      <div
        aria-hidden={!mobileOpen}
        className={`fixed top-0 left-0 w-[280px] max-w-[85vw] h-screen border-r border-zinc-200 z-[5000] flex flex-col overflow-hidden transition-[transform,visibility,box-shadow] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]
          ${mobileOpen ? 'translate-x-0 visible shadow-[0_0_70px_rgba(0,0,0,0.25)]' : '-translate-x-full invisible'}`}
        style={{ background: 'linear-gradient(180deg, #fbfbfd 0%, #f1f2f6 100%)', fontFamily: FONT }}
      >
        <style>{SIDEBAR_CSS}</style>
        <div className="pointer-events-none absolute -top-24 -left-16 w-64 h-64 rounded-full bg-sky-300/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-20 -right-20 w-56 h-56 rounded-full bg-violet-300/20 blur-3xl" aria-hidden="true" />

        {/* Brand + close */}
        <div className="relative px-6 pt-7 pb-5 flex items-start justify-between gap-3">
          <div>
            <div className="text-[19px] font-semibold tracking-tight leading-tight bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg, #111114 0%, #4a4a58 100%)' }}>
              Ticket Routing System
            </div>
            <div className="text-[12px] text-zinc-500 mt-1">
              AI Agent Platform
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 px-3 py-1.5 rounded-full bg-white ring-1 ring-black/[0.08] shadow-sm text-[12px] font-medium text-zinc-600 hover:bg-[#f5f5f7] active:scale-95 transition-all duration-200 cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Navigation */}
        <div className="relative flex-1 overflow-y-auto pb-2 custom-scrollbar">
          {NAV_GROUPS.map((group, gi) => (
            <div
              key={group.label}
              className="mb-4"
              style={mobileOpen ? { animation: `sb-in .45s cubic-bezier(.2,.8,.2,1) ${60 + gi * 60}ms both` } : undefined}
            >
              <div className="px-6 mb-1.5 text-[12px] font-semibold text-zinc-400">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path)
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={`relative flex items-center px-3.5 py-2 mx-3 rounded-xl transition-all duration-200 text-[14px]
                        ${isActive
                          ? 'bg-white text-zinc-900 font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04]'
                          : 'text-zinc-600 font-medium hover:text-zinc-900 hover:bg-white/70 hover:translate-x-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]'}`}
                    >
                      {isActive && (
                        <span className="absolute left-1.5 top-2 bottom-2 w-[3px] rounded-full" style={{ background: 'linear-gradient(180deg, #3aa0ff, #0071e3)' }} />
                      )}
                      <span className={isActive ? 'pl-2' : ''}>{item.name}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Command Palette */}
          <div className="mx-3 mt-1">
            <button
              onClick={() => { window.dispatchEvent(new CustomEvent('nexus:openPalette')); onClose?.() }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-white/80 backdrop-blur ring-1 ring-black/[0.06] text-zinc-600 hover:text-zinc-900 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(0,0,0,0.09)] active:scale-[0.98] transition-all duration-200 text-[13px] font-medium cursor-pointer"
            >
              <span>Command Palette</span>
              <span className="text-[11px] text-zinc-400 bg-[#f5f5f7] px-1.5 py-0.5 rounded-md">⌘K</span>
            </button>
          </div>
        </div>

        {/* Status footer */}
        <div className="relative p-4 border-t border-black/[0.07] bg-white/50 backdrop-blur-xl flex items-center justify-between gap-3">
          <div className={`text-[12px] font-medium ${state.authenticated ? 'text-emerald-700' : 'text-amber-600'}`}>
            {state.authenticated ? 'Google connected' : 'Google not connected'}
          </div>
          {state.authenticated ? (
            <button
              onClick={handleLogout}
              className="shrink-0 px-3.5 py-1.5 rounded-full bg-white ring-1 ring-black/[0.06] text-[12px] font-medium text-red-600 hover:bg-red-50 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              Log out
            </button>
          ) : (
            <button
              onClick={login}
              style={{ background: 'linear-gradient(135deg, #3aa0ff, #0071e3)' }}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-medium text-white shadow-[0_4px_12px_rgba(0,113,227,0.35)] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,113,227,0.45)] active:scale-95 transition-all duration-200 cursor-pointer"
            >
              Log in
            </button>
          )}
        </div>
      </div>
    </>
  )
}
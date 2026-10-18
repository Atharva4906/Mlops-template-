import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { login, logout } from '../../services/api'

const LINKS = [
  { name: 'Dashboard', path: '/' },
  { name: 'Inbox', path: '/email' },
  { name: 'Queue', path: '/inbox' },
  { name: 'Metrics', path: '/metrics' },
  { name: 'Assistant', path: '/assistant' },
]

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif'

export default function Topbar({ menuOpen, onMenu }) {
  const { state, dispatch } = useApp()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      dispatch({ type: 'SET_AUTH', authenticated: false, email: '' })
    }
  }

  return (
    <header
      className={`fixed top-0 inset-x-0 h-16 z-[4900] flex items-center gap-3 px-4 lg:px-8 backdrop-blur-xl transition-all duration-300 ${scrolled ? 'bg-white/85 border-b border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.05)]' : 'bg-white/60 border-b border-transparent'}`}
      style={{ fontFamily: FONT }}
    >
      {/* Drawer toggle */}
      <button
        onClick={onMenu}
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={menuOpen}
        className="shrink-0 min-w-[68px] px-4 py-2 rounded-full bg-[#f5f5f7] hover:bg-[#ebebef] text-[13px] font-medium text-zinc-700 active:scale-95 transition-all duration-200 cursor-pointer"
      >
        {menuOpen ? 'Close' : 'Menu'}
      </button>

      {/* Brand */}
      <Link to="/" className="shrink-0 flex items-baseline gap-1.5 pl-1">
        <span className="text-[19px] font-semibold tracking-tight text-zinc-900">Ticket Routing</span>
        <span className="text-[13px] font-medium text-[#0071e3]">.ai</span>
      </Link>

      {/* Primary links */}
      <nav className="hidden md:flex items-center gap-1 ml-4">
        {LINKS.map(l => (
          <NavLink
            key={l.path}
            to={l.path}
            end={l.path === '/'}
            className={({ isActive }) => `relative px-3.5 py-2 rounded-full text-[14px] font-medium transition-colors duration-200 ${isActive ? 'text-zinc-900 bg-black/[0.05]' : 'text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.04]'}`}
          >
            {l.name}
          </NavLink>
        ))}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('nexus:openPalette'))}
          className="ml-1 px-3.5 py-2 rounded-full text-[14px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.04] transition-colors cursor-pointer"
        >
          Search
        </button>
      </nav>

      <div className="flex-1" />

      {/* Auth + primary action */}
      {state?.authenticated ? (
        <button
          onClick={handleLogout}
          className="hidden sm:block px-3.5 py-2 rounded-full text-[14px] font-medium text-zinc-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          Log out
        </button>
      ) : (
        <button
          onClick={login}
          className="hidden sm:block px-3.5 py-2 rounded-full text-[14px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04] transition-colors cursor-pointer"
        >
          Log in
        </button>
      )}

      <Link
        to="/ticket-simulator"
        className="shrink-0 px-5 py-2.5 rounded-full text-[14px] font-medium text-white shadow-[0_4px_14px_rgba(0,113,227,0.35)] hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,113,227,0.45)] active:scale-95 transition-all duration-200"
        style={{ background: 'linear-gradient(135deg, #3aa0ff 0%, #0071e3 100%)' }}
      >
        Submit test ticket
      </Link>
    </header>
  )
}
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import WebSocketProvider from './context/WebSocketProvider'
import { getAuthStatus } from './services/api'
import ToastContainer from './components/ui/ToastContainer'

import TicketRoutingDashboard from './pages/TicketRoutingDashboard'
import TicketSimulator from './pages/TicketSimulator'
import Settings from './pages/Settings'
import Actions from './pages/Actions'
import TicketQueue from './pages/TicketQueue'
import TicketDomains from './pages/TicketDomains'
import Inbox from './pages/Inbox'
import Showcase from './pages/Showcase'
import Metrics from './pages/Metrics'
// import BRDs from './pages/BRDs' // BRD generation is inactive for ticket routing.
import Escalations from './pages/Escalations'
import Upload from './pages/Upload'
import Calendar from './pages/Calendar'
import Assistant from './pages/Assistant'
import Bandit from './pages/Bandit'
import MLOpsDashboard from './pages/MLOpsDashboard'

import Sidebar from './components/Layout/Sidebar'
import Topbar from './components/Layout/Topbar'
import CommandPalette from './components/ui/CommandPalette'
import AssistantWidget from './components/ui/AssistantWidget'

function LayoutShell() {
  const { dispatch } = useApp()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    getAuthStatus()
      .then(({ authenticated, email }) => {
        dispatch({ type: 'SET_AUTH', authenticated: Boolean(authenticated), email })
      })
      .catch(() => {})
  }, [dispatch])

  /* Close the drawer on route change */
  useEffect(() => { setNavOpen(false) }, [location.pathname])

  /* Close the drawer with Escape */
  useEffect(() => {
    if (!navOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setNavOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  const isAssistant = location.pathname.startsWith('/assistant')

  /* White theme for the whole app: keep the page background (overscroll area) white too */
  useEffect(() => {
    document.body.classList.add('light-shell')
    return () => document.body.classList.remove('light-shell')
  }, [])

  return (
    <>
      <Topbar menuOpen={navOpen} onMenu={() => setNavOpen(v => !v)} />

      {/* Slide-in navigation drawer */}
      <Sidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />

      <div className="min-h-screen relative bg-white text-zinc-900">
        <main
          key={location.pathname}
          className={`page-enter w-full z-10 ${isAssistant ? 'pt-16' : 'pt-24 pb-16 px-5 lg:px-10'}`}
        >
          <Routes>
            <Route path="/" element={<TicketRoutingDashboard />} />
            <Route path="/ticket-simulator" element={<TicketSimulator />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/directives" element={<Settings />} />
            <Route path="/actions" element={<Actions />} />
            <Route path="/inbox" element={<TicketQueue />} />
            <Route path="/email" element={<Inbox />} />
            <Route path="/chat" element={<Upload />} />
            <Route path="/showcase" element={<Showcase />} />
            <Route path="/ticket-domains" element={<TicketDomains />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/mlops" element={<MLOpsDashboard />} />
            {/* <Route path="/brds" element={<BRDs />} /> BRD generation is inactive. */}
            <Route path="/escalations" element={<Escalations />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/bandit" element={<Bandit />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <CommandPalette />
      {/* The floating widget is redundant on the full Assistant page */}
      {!isAssistant && <AssistantWidget />}
      <ToastContainer />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <WebSocketProvider>
          <LayoutShell />
        </WebSocketProvider>
      </HashRouter>
    </AppProvider>
  )
}
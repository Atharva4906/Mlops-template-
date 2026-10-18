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
import CommandPalette from './components/ui/CommandPalette'
import DynamicIsland from './components/ui/DynamicIsland'
import AssistantWidget from './components/ui/AssistantWidget'

/* Pages already converted to the white theme. Add a path here as each page is restyled. */
const LIGHT_ROUTES = ['/', '/assistant', '/email', '/showcase', '/inbox']

function LayoutShell() {
  const { dispatch } = useApp()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    getAuthStatus()
      .then(({ authenticated, email }) => {
        dispatch({ type: 'SET_AUTH', authenticated: Boolean(authenticated), email })
      })
      .catch(() => {})
  }, [dispatch])

  /* Close mobile nav on route change */
  useEffect(() => { setMobileNavOpen(false) }, [location.pathname])

  const isWide = location.pathname === '/projects'
  const isLight = LIGHT_ROUTES.some(p => (p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)))
  const isAssistant = location.pathname.startsWith('/assistant')

  /* Keep the page background (overscroll area) in sync with the theme of the current page */
  useEffect(() => {
    document.body.classList.toggle('light-shell', isLight)
    return () => document.body.classList.remove('light-shell')
  }, [isLight])

  return (
    <>
      {/* Dynamic Island */}
      <DynamicIsland />

      {/* Mobile top bar */}
      <div
        className="fixed top-0 left-0 right-0 h-14 lg:hidden z-[4900] flex items-center justify-between px-4 bg-white/80 backdrop-blur-xl border-b border-black/[0.08]"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, system-ui, sans-serif' }}
      >
        <button
          onClick={() => setMobileNavOpen(v => !v)}
          className="px-3.5 py-1.5 rounded-full bg-[#f5f5f7] text-[13px] font-medium text-zinc-700 active:scale-95 transition-all"
          aria-label="Open navigation"
        >
          Menu
        </button>
        <div className="text-[16px] font-semibold tracking-tight text-zinc-900">
          Ticket Routing Agent
        </div>
        <div className="w-[62px]" />
      </div>

      <div className={`min-h-screen relative flex ${isLight ? 'bg-white text-zinc-900' : 'bg-brand-black text-white'}`}>
        <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

        {/* Main content */}
        <div className={`flex-1 min-w-0 lg:ml-[260px] pt-14 lg:pt-0 ${isAssistant ? 'pb-0' : 'pb-28 lg:pb-8'}`}>
          <main
            key={location.pathname}
            className={`page-enter w-full z-10 transition-all
              ${isAssistant
                ? ''
                : `mx-auto pt-8 lg:pt-14 ${isWide ? 'max-w-[1600px] px-5 lg:px-8' : 'max-w-[1040px] px-5 lg:px-12'}`}`}
          >
            <Routes>
              <Route path="/" element={<TicketRoutingDashboard />} />
              <Route path="/ticket-simulator" element={<TicketSimulator />} />
              <Route path="/settings" element={<Settings />} />
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
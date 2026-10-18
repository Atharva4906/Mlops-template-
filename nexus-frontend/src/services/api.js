// All API calls go through Vite's dev proxy to http://localhost:8000
const BASE = ''

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, opts)
  return res.json()
}

// Auth
export const login = () => {
  window.location.assign('/auth/login')
}
export const callback = (code, state) => req(`/auth/callback?code=${code}&state=${state}`)
export const getAuthStatus = () => req('/auth/status')
export const logout = () => req('/auth/logout', { method: 'POST' })

// Stats & Metrics
export const getStats = () => req('/api/stats')
export const getMetrics = () => req('/api/metrics')
export const getSummary = () => req('/api/summary')

// Direct support routing
export const getTickets = (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value))
  return req(`/api/tickets${query.toString() ? `?${query}` : ''}`)
}
export const getTicket = (id) => req(`/api/tickets/${id}`)
export const createTicket = (ticket) => req('/api/v1/tickets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(ticket),
})
export const reassignTicket = (id, specialist_queue, reason = '') => req(`/api/v1/tickets/${id}/reassign`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ specialist_queue, reason }),
})
export const updateTicketStatus = (id, status) => req(`/api/tickets/${id}/status`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status }),
})
export const getQueues = () => req('/api/queues')
export const getRoutingMetrics = () => req('/api/routing/metrics')
export const getMLOpsMetrics = () => req('/api/v1/mlops/metrics')
export const evaluateMLOpsDrift = () => req('/api/v1/mlops/evaluate-drift', { method: 'POST' })
export const retrainMLOps = () => req('/api/v1/mlops/trigger-retrain', { method: 'POST' })
export const promoteMLOpsModel = () => req('/api/v1/mlops/promote', { method: 'POST' })
export const getTicketDomains = (includeInactive = false) => req(`/api/ticket-domains${includeInactive ? '?include_inactive=true' : ''}`)
export const createTicketDomain = (domain) => req('/api/ticket-domains', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(domain),
})
export const updateTicketDomain = (slug, domain) => req(`/api/ticket-domains/${slug}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(domain),
})
export const deactivateTicketDomain = (slug) => req(`/api/ticket-domains/${slug}`, { method: 'DELETE' })
export const getIntentDomains = () => req('/api/ticket-domains/intents')
export const updateIntentDomain = (intent, domain) => req(`/api/ticket-domains/intents/${intent}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ domain }),
})

// Emails
export const getEmails = (limit = 5) => req(`/api/emails?limit=${limit}`)
export const getEmail = (id) => req(`/api/emails/${id}`)
export const processEmail = (id) => req(`/api/emails/process/${id}`, { method: 'POST' })
/* export const clusterManual = (email_ids, title) =>
  req('/api/emails/cluster-manual', { 
    method: 'POST', 
    headers: {'Content-Type': 'application/json'}, 
    body: JSON.stringify({email_ids, title}) 
  }) */

// Actions
export const getActions = (status='') => req(`/api/actions${status ? '?status='+status : ''}`)
export const getActionsBySections = () => req('/api/actions/sections')
export const approveAction = (id, body) => 
  req(`/api/actions/${id}/approve`, { 
    method: 'POST', 
    headers: {'Content-Type': 'application/json'}, 
    body: JSON.stringify(body || {}) 
  })
export const rejectAction = (id) => req(`/api/actions/${id}/reject`, { method: 'POST' })
export const editDraft = (id, body) => 
  req(`/api/actions/${id}/draft`, { 
    method: 'PUT', 
    headers: {'Content-Type': 'application/json'}, 
    body: JSON.stringify(body) 
  })

/*
// Project clustering is inactive for the ticket-routing application.
export const getPendingClusters = () => req('/api/clusters/pending')
export const forceRecluster = (limit = 5) => req(`/api/clusters/recluster?limit=${limit}`, { method: 'POST' })
*/

// Projects
export const getProjects = () => req('/api/projects')
export const createProject = (name, description = '') => 
  req('/api/projects', { 
    method: 'POST', 
    headers: {'Content-Type': 'application/json'}, 
    body: JSON.stringify({name, description}) 
  })
export const getProject = (id) => req(`/api/projects/${id}`)
export const getProjectContext = (id) => req(`/api/projects/${id}/context`)
export const getProjectEmails = (id) => req(`/api/projects/${id}/emails`)
export const getProjectDocuments = (id) => req(`/api/projects/${id}/documents`)
export const deleteProject = (id) => req(`/api/projects/${id}`, { method: 'DELETE' })

/* export const getProjectBRD = (id) => req(`/api/projects/${id}/brd`)
export const getProjectBRDStatus = (id) => req(`/api/projects/${id}/brd/status`)
export const generateProjectBRD = (id) => req(`/api/projects/${id}/generate-brd`, { method: 'POST' }) */
export const runProjectAgent = (id) => req(`/api/projects/${id}/agent`, { method: 'POST' })
export const assignEmail = (id, email_id) => 
  req(`/api/projects/${id}/assign-email`, { 
    method: 'POST', 
    headers: {'Content-Type': 'application/json'}, 
    body: JSON.stringify({email_id}) 
  })
export const attachEmail = (id, email_id) => 
  req(`/api/projects/${id}/attach_email`, { 
    method: 'POST', 
    headers: {'Content-Type': 'application/json'}, 
    body: JSON.stringify({email_id}) 
  })
export const attachEmailToProject = attachEmail
export const uploadProjectDoc = (projectId, file) => {
  const fd = new FormData()
  fd.append('file', file)
  return fetch(`${BASE}/api/projects/${projectId}/upload-doc`, { method: 'POST', body: fd }).then(r => r.json())
}

// Assignments
export const getUnassignedEmails = () => req('/api/emails/unassigned')

/*
// BRD generation is inactive for the ticket-routing application.
export const brdFromUpload = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return fetch(`${BASE}/api/brd/from-upload`, { method: 'POST', body: fd }).then(r => r.json())
}
export const getBrdResult = (id) => req(`/api/brd/${id}/result`)
export const getBrdSections = (jobId) => req(`/api/brd/${jobId}/sections`)
export const downloadBrd = (jobId) => window.open(`${BASE}/api/brd/${jobId}/download`, '_blank')
export const listBrds = () => req('/api/brd/list')
*/

// Calendar
export const getCalendarEvents = (days = 14) => req(`/api/calendar/events?days=${days}`)
export const cancelEvent = (id) => req(`/api/calendar/events/${id}`, { method: 'DELETE' })
export const deleteCalendarEvent = cancelEvent

// Ingest
export const fetchMultiChannel = () => req('/api/multi-channel/fetch')
export const ingestMultiChannel = () => req('/api/multi-channel/ingest', { method: 'POST' })
export const noiseScoreTool = () => req('/api/tools/noise-score', { method: 'POST' })
export const ingestStatus = () => req('/api/ingest/status')
export const scanIngest = () => req('/api/ingest/scan', { method: 'POST' })
export const resetIngest = () => req('/api/ingest/reset', { method: 'POST' })

/* // Actions extras: BRD generation is inactive.
export const generateBrdForAction = (id) => req(`/api/actions/${id}/generate-brd`, { method: 'POST' })
*/

// Bandit prototype
export const getBanditState = () => req('/api/bandit/state')
export const sendBanditFeedback = (project_id, reward = 1, email_id = null, event = 'reward') =>
  req('/api/bandit/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id, reward, email_id, event })
  })

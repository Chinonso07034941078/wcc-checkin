const API_URL = import.meta.env.VITE_WCC_API_URL || 'https://script.google.com/macros/s/AKfycbwLr43-zPDMqX0ophirx4UrdGnFuqBL0B9aDLXQPydWkEDzHWKFvc2p9pPHQMZkAz7_/exec'

export const SESSIONS = [
  'Wednesday Evening',
  'Thursday Morning',
  'Thursday Evening',
  'Friday Morning',
  'Friday Evening',
  'Saturday Morning',
  'Sunday Morning',
]

const AUTH_TOKEN_KEY = 'wcc-admin-token'
const AUTH_FLAG_KEY = 'wcc-admin-authenticated'

function requireApiUrl() {
  if (!API_URL) throw new Error('WCC API URL is not configured. Add VITE_WCC_API_URL to your .env file.')
  return API_URL
}

function getAuthToken() {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

function setAuthToken(token) {
  try {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token)
    sessionStorage.setItem(AUTH_FLAG_KEY, '1')
  } catch {}
}

export function clearAdminAuth() {
  try {
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    sessionStorage.removeItem(AUTH_FLAG_KEY)
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wcc-admin-logout'))
  }
}

function handleUnauthorized(message = 'Admin login is required.') {
  clearAdminAuth()
  throw new Error(message)
}

async function getRequest(params, { protectedRequest = true } = {}) {
  const url = new URL(requireApiUrl())
  const finalParams = { ...params }

  if (protectedRequest) {
    const token = getAuthToken()
    if (!token) handleUnauthorized()
    finalParams.token = token
  }

  Object.entries(finalParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) throw new Error(`API request failed (${response.status})`)

  const data = await response.json()

  if (data.status === 'unauthorized' || data.authenticated === false) {
    handleUnauthorized(data.error || 'Admin login has expired. Please log in again.')
  }

  if (!data.ok) throw new Error(data.error || 'The WCC service returned an error.')

  return data
}

async function postRequest(payload, { protectedRequest = true } = {}) {
  const body = { ...payload }

  if (protectedRequest) {
    const token = getAuthToken()
    if (!token) handleUnauthorized()
    body.token = token
  }

  const response = await fetch(requireApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) throw new Error(`API request failed (${response.status})`)

  const data = await response.json()

  if (data.status === 'unauthorized' || data.authenticated === false) {
    handleUnauthorized(data.error || 'Admin login has expired. Please log in again.')
  }

  if (!data.ok) throw new Error(data.error || 'The WCC service returned an error.')

  return data
}

export async function authenticateAdmin(password) {
  /* Login itself is public; the server decides whether the password is correct. */
  const data = await postRequest(
    { action: 'login', password },
    { protectedRequest: false }
  )

  if (!data.authenticated || !data.token) {
    throw new Error(data.error || 'Incorrect admin password.')
  }

  setAuthToken(data.token)
  return data
}

export async function lookupMembers(query) {
  const data = await getRequest({ action: 'lookup', q: query })
  return (data.members || []).map(member => ({
    registrationId: String(member.registrationId ?? ''),
    checkInCode: String(member.checkInCode ?? ''),
    name: String(member.name ?? ''),
  }))
}

export async function checkIn({ registrationId, checkInCode, session }) {
  return postRequest({
    action: 'checkin',
    registrationId,
    checkInCode,
    session,
  })
}

export async function getHistory(registrationId) {
  return getRequest({
    action: 'history',
    registrationId,
  })
}

const DASHBOARD_CACHE_KEY = 'wcc2026-dashboard-cache-v3'

export async function getDashboard() {
  try {
    const data = await getRequest({ action: 'dashboard' })
    try {
      localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(data))
    } catch {}
    return data
  } catch (error) {
    /* Never silently turn a failed live response into zeroes. */
    try {
      const cached = JSON.parse(localStorage.getItem(DASHBOARD_CACHE_KEY) || 'null')
      if (cached?.ok && cached?.sessions) return { ...cached, cached: true }
    } catch {}
    throw error
  }
}

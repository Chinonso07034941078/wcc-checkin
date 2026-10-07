const API_URL = import.meta.env.VITE_WCC_API_URL || ''

export const SESSIONS = [
  'Wednesday Evening',
  'Thursday Morning',
  'Thursday Evening',
  'Friday Morning',
  'Friday Evening',
  'Saturday Morning',
  'Sunday Morning',
]

function requireApiUrl() {
  if (!API_URL) throw new Error('WCC API URL is not configured. Add VITE_WCC_API_URL to your .env file.')
  return API_URL
}

async function getRequest(params) {
  const url = new URL(requireApiUrl())
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })
  const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
  if (!response.ok) throw new Error(`API request failed (${response.status})`)
  const data = await response.json()
  if (!data.ok) throw new Error(data.error || 'The WCC service returned an error.')
  return data
}

async function postRequest(payload) {
  const response = await fetch(requireApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`API request failed (${response.status})`)
  const data = await response.json()
  if (!data.ok) throw new Error(data.error || 'The WCC service returned an error.')
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
  return postRequest({ action: 'checkin', registrationId, checkInCode, session })
}

export async function getHistory(registrationId) {
  return getRequest({ action: 'history', registrationId })
}

export async function getDashboard() {
  return getRequest({ action: 'dashboard' })
}

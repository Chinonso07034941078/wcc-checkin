import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, Copy, History, RefreshCcw, Search, ShieldCheck, Sparkles, UserRound, UsersRound, X } from 'lucide-react'
import CheckinCard from './components/CheckinCard'
import Dashboard from './components/Dashboard'
import { SESSIONS, authenticateAdmin, checkIn, clearAdminAuth, getDashboard, getHistory, lookupMembers } from './utils/api'

const LOGO = 'https://res.cloudinary.com/dnvgl9k4i/image/upload/v1790827899/The_Takeover_Generation_Logo_2_zcvm8n.png'
const FLYER = '/wcc-2026-flyer-reference.jpg'

function formatNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value ?? '0')
  return number.toLocaleString('en-NG')
}

function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await authenticateAdmin(password)
      onLogin()
    } catch (err) {
      setError(err.message || 'Incorrect admin password.')
      setPassword('')
    }
    setBusy(false)
  }

  return (
    <main className="login-shell">
      <div className="login-backdrop" />
      <section className="login-card">
        <div className="login-brand-panel">
          <div className="brand-logo-shell login-logo-shell">
            <img src={LOGO} alt="The Takeover Generation" />
          </div>
          <p className="login-kicker">World Changers Convention · 2026</p>
          <h1 className="font-adero login-title">Admin<br /><span>Check-in</span></h1>
          <p className="login-date">11TH–15TH NOVEMBER ’26</p>
        </div>
        <form onSubmit={submit} className="login-form">
          <div>
            <p className="eyebrow">Restricted access</p>
            <h2>Welcome back</h2>
            <p className="login-copy">Enter the admin password to access the WCC live check-in desk.</p>
          </div>
          <label className="login-label">
            Admin password
            <div className="login-input-wrap">
              <ShieldCheck size={18} />
              <input
                autoFocus
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPassword(value => !value)} className="login-show" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          {error && <p className="login-error">{error}</p>}
          <button disabled={busy || !password} className="login-submit" type="submit">
            {busy ? 'Checking…' : 'Enter check-in desk'} <ArrowRight size={18} />
          </button>
          <p className="login-note"><ShieldCheck size={14} /> Admin access required before attendee information is displayed.</p>
        </form>
      </section>
    </main>
  )
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(sessionStorage.getItem('wcc-admin-token')))

  useEffect(() => {
    const handleAdminLogout = () => setAuthenticated(false)
    window.addEventListener('wcc-admin-logout', handleAdminLogout)
    return () => window.removeEventListener('wcc-admin-logout', handleAdminLogout)
  }, [])
  const [query, setQuery] = useState('')
  const [session, setSession] = useState(SESSIONS[0])
  const [members, setMembers] = useState([])
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [loadingCheckin, setLoadingCheckin] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [copied, setCopied] = useState('')

  const hasQuery = query.trim().length > 0
  const searchResults = useMemo(() => members.slice(0, 8), [members])
  const currentSessionCount = dashboard?.sessions?.[session]
  const dashboardCached = Boolean(dashboard?.cached)
  const alreadyInSession = history.some(item => item.session === session)

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!hasQuery) {
        setMembers([])
        setSelected(null)
        setHistory([])
        setError('')
        return
      }
      setLoadingSearch(true)
      setError('')
      setSuccess(null)
      try {
        const results = await lookupMembers(query.trim())
        setMembers(results)
        setSelected(results.length === 1 ? results[0] : null)
      } catch (err) {
        setMembers([])
        setSelected(null)
        setError(err.message)
      } finally {
        setLoadingSearch(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, hasQuery])

  useEffect(() => {
    let cancelled = false
    async function loadHistory() {
      if (!selected) {
        setHistory([])
        return
      }
      setHistoryLoading(true)
      try {
        const result = await getHistory(selected.registrationId || selected.checkInCode)
        if (!cancelled) setHistory(result.sessions || [])
      } catch {
        if (!cancelled) setHistory([])
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }
    loadHistory()
    return () => { cancelled = true }
  }, [selected])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    async function refreshHistory() {
      try {
        const result = await getHistory(selected.registrationId || selected.checkInCode)
        if (!cancelled) setHistory(result.sessions || [])
      } catch {}
    }
    refreshHistory()
    return () => { cancelled = true }
  }, [success])

  const refreshDashboard = async () => {
    setDashboardLoading(true)
    try {
      setDashboard(await getDashboard())
    } catch (err) {
      setError(err.message)
    } finally {
      setDashboardLoading(false)
    }
  }

  useEffect(() => {
    refreshDashboard()
    const timer = setInterval(refreshDashboard, 15000)
    return () => clearInterval(timer)
  }, [])

  const selectMember = member => {
    setSelected(member)
    setSuccess(null)
    setError('')
  }

  const requestCheckin = () => {
    if (!selected || loadingCheckin || historyLoading || alreadyInSession) return
    setError('')
    setSuccess(null)
    setConfirming(true)
  }

  const doCheckin = async () => {
    if (!selected || loadingCheckin || alreadyInSession) return
    setLoadingCheckin(true)
    setError('')
    try {
      const result = await checkIn({
        registrationId: selected.registrationId,
        checkInCode: selected.checkInCode,
        session,
      })
      if (result.status === 'already_checked_in') {
        setSuccess({ type: 'already', ...result })
      } else {
        setSuccess({ type: 'checked', ...result })
      }
      setConfirming(false)
      await refreshDashboard()
      const fresh = await getHistory(selected.registrationId || selected.checkInCode)
      setHistory(fresh.sessions || [])
    } catch (err) {
      setError(err.message)
      setConfirming(false)
    } finally {
      setLoadingCheckin(false)
    }
  }

  const clearSearch = () => {
    setQuery('')
    setMembers([])
    setSelected(null)
    setHistory([])
    setConfirming(false)
    setSuccess(null)
    setError('')
  }

  const copyValue = async (label, value) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(String(value))
      setCopied(label)
      setTimeout(() => setCopied(''), 1200)
    } catch {}
  }

  if (!authenticated) {
    return <AdminLogin onLogin={() => setAuthenticated(true)} />
  }

  const logout = () => {
    clearAdminAuth()
    setAuthenticated(false)
    setQuery('')
    setSelected(null)
  }

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#241c1a]">
      {/* Brand header: dark because the white logo needs contrast. */}
      <header className="brand-dark border-b border-white/10">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-4">
            <div className="brand-logo-shell rounded-2xl px-3 py-2 sm:px-4">
              <img src={LOGO} alt="The Takeover Generation" className="h-10 w-auto object-contain sm:h-12" />
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] font-black uppercase tracking-[.3em] text-[#f39a4a]">World Changers Convention</p>
              <p className="mt-1 text-xs font-medium text-white/60">11–15 November ’26 · Live check-in</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[.07] px-3.5 py-2 text-[10px] font-black uppercase tracking-[.14em] text-white/75">
              <span className="h-2 w-2 rounded-full bg-[#55d38a] shadow-[0_0_0_4px_rgba(85,211,138,.12)]" />
              <Activity size={14} className="text-[#f39a4a]" />
              Live
            </div>
            <button onClick={logout} className="rounded-full border border-white/10 bg-white/[.07] px-3.5 py-2 text-[10px] font-black uppercase tracking-[.14em] text-white/65 transition hover:bg-white/10 hover:text-white">Lock desk</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1380px] px-5 py-6 sm:px-8 sm:py-9 lg:px-10">
        {/* Dark visual hero inspired by the flyer. */}
        <section className="flyer-hero relative overflow-hidden rounded-[30px] border border-[#4d1116] shadow-[0_24px_70px_rgba(63,22,20,.15)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(241,125,39,.18),transparent_30%),linear-gradient(100deg,rgba(91,8,14,.98),rgba(47,5,9,.96))]" />
          <div className="absolute inset-0 opacity-[.18]" style={{ backgroundImage: `url(${FLYER})`, backgroundSize: 'cover', backgroundPosition: 'center 16%' }} />
          <div className="relative grid min-h-[270px] items-center gap-8 px-7 py-8 sm:px-10 lg:grid-cols-[1.2fr_.8fr] lg:px-14 lg:py-11">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[.3em] text-[#f39a4a]">
                <Sparkles size={14} /> WCC 2026 · Check-in desk
              </div>
              <h1 className="font-adero max-w-3xl text-5xl font-black uppercase leading-[.88] tracking-[-.045em] text-white sm:text-6xl lg:text-7xl">
                The Takeover<br /><span className="text-[#f39a4a]">Generation</span>
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-6 text-white/65">Find a live registration, verify the attendee, choose today’s session and record one clean attendance entry.</p>
            </div>
            <div className="hidden justify-self-end lg:block">
              <div className="brand-logo-shell max-w-[390px] rounded-[26px] p-5">
                <img src={LOGO} alt="The Takeover Generation" className="w-full object-contain" />
              </div>
              <div className="mt-3 flex justify-end gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-white/45">
                <span>11TH–15TH</span><span>·</span><span>NOVEMBER ’26</span>
              </div>
            </div>
          </div>
        </section>

        {/* Session rail */}
        <section className="mt-6 rounded-[24px] border border-[#e7dcd4] bg-white p-3 shadow-[0_12px_40px_rgba(64,39,28,.05)] sm:p-4">
          <div className="flex items-center justify-between gap-4 px-2 pb-3 sm:px-3">
            <div><p className="text-[9px] font-black uppercase tracking-[.25em] text-[#a18d84]">Attendance sessions</p><p className="mt-1 text-sm font-black text-[#302724]">Select the session being checked in now</p></div>
            <div className="hidden rounded-full bg-[#fff3e8] px-3 py-2 text-[10px] font-black text-[#9b4e27] sm:block">{currentSessionCount == null ? '—' : formatNumber(currentSessionCount)} in selected session{dashboardCached ? ' · cached' : ''}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
            {SESSIONS.map((item, index) => {
              const active = session === item
              return <button key={item} onClick={() => { setSession(item); setSuccess(null) }} className={`session-pill ${active ? 'session-pill-active' : ''}`}>
                <span className="text-[9px] font-black uppercase tracking-[.16em] opacity-55">0{index + 1}</span>
                <span className="mt-1 text-[11px] font-black leading-4">{item}</span>
                <span className={`mt-2 text-lg font-black ${active ? 'text-white' : 'text-[#7c171d]'}`}>{dashboardLoading ? '—' : dashboard?.sessions?.[item] == null ? '—' : formatNumber(dashboard.sessions[item])}</span>
              </button>
            })}
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-[30px] border border-[#e7dcd4] bg-white p-5 shadow-[0_18px_55px_rgba(64,39,28,.06)] sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 text-[#8a171d]"><ShieldCheck size={18} /><span className="text-[10px] font-black uppercase tracking-[.26em]">Check-in desk</span></div>
                <h2 className="mt-2 font-adero text-3xl font-black uppercase tracking-[-.02em] text-[#2a211f] sm:text-4xl">Find attendee</h2>
                <p className="mt-2 max-w-xl text-sm text-[#81736d]">Search the registration sheet live. No manual member list is required.</p>
              </div>
              <button onClick={refreshDashboard} className="rounded-2xl border border-[#e5d9d2] bg-[#faf7f3] p-3 text-[#786a63] transition hover:border-[#c9a79b] hover:text-[#8a171d]" title="Refresh attendance"><RefreshCcw className={dashboardLoading ? 'animate-spin' : ''} size={17} /></button>
            </div>

            <div className="mt-6 rounded-[22px] border border-[#eaded7] bg-[#fbf8f4] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#a18d84]">Checking in for</p><p className="mt-1 text-lg font-black text-[#8a171d]">{session}</p></div>
                <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#746761]"><CalendarDays size={14} className="text-[#e47724]" /> Session {SESSIONS.indexOf(session) + 1} / 7</div>
              </div>
            </div>

            <CheckinCard query={query} setQuery={setQuery} results={searchResults} selected={selected} setSelected={selectMember} loading={loadingSearch || loadingCheckin} history={history} historyLoading={historyLoading} selectedSession={session} onCheckin={requestCheckin} onClear={clearSearch} />

            {success && (
              <div className={`mt-5 rounded-[22px] border p-5 ${success.type === 'checked' ? 'border-[#b9dfc8] bg-[#f0faf4]' : 'border-[#f1d79e] bg-[#fff9eb]'}`}>
                <div className="flex items-start gap-3">
                  {success.type === 'checked' ? <CheckCircle2 className="mt-0.5 shrink-0 text-[#2f9a63]" /> : <Clock3 className="mt-0.5 shrink-0 text-[#b57a16]" />}
                  <div className="min-w-0"><p className="font-black text-[#302724]">{success.type === 'checked' ? 'Check-in recorded' : 'Already checked in'}</p><p className="mt-1 text-sm text-[#665953]">{success.member?.name} · {success.session}</p><p className="mt-1 text-xs text-[#8b7c75]">Registration ID: <strong>{success.member?.registrationId || '—'}</strong></p></div>
                </div>
              </div>
            )}
            {error && <div className="mt-5 flex items-start justify-between gap-3 rounded-2xl border border-[#efc9c9] bg-[#fff4f4] p-4 text-sm font-semibold text-[#8b171d]"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={17} /></button></div>}
          </div>

          <aside className="overflow-hidden rounded-[30px] border border-[#4d1116] bg-[#4a090e] text-white shadow-[0_18px_55px_rgba(64,10,14,.12)]">
            <div className="brand-dark p-6 sm:p-7">
              <div className="brand-logo-shell rounded-2xl p-3"><img src={LOGO} alt="The Takeover Generation" className="w-full object-contain" /></div>
              <p className="mt-6 text-[10px] font-black uppercase tracking-[.26em] text-[#f39a4a]">Verification flow</p>
              <h3 className="mt-2 font-adero text-2xl font-black uppercase leading-[.95]">Simple. Fast.<br />Accurate.</h3>
              <div className="mt-6 space-y-4">
                {[['01','Search','Use registration ID, check-in code or attendee name.'],['02','Verify','Check the attendee details and session before saving.'],['03','Record','Confirm once. The server blocks duplicates for the same session.']].map(([n,title,copy]) => <div key={n} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-black text-[#f39a4a]">{n}</span><div><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5 text-white/55">{copy}</p></div></div>)}
              </div>
            </div>
            <div className="border-t border-white/10 bg-white/[.04] p-6 sm:p-7">
              <div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-white/45">Live total</p><p className="mt-1 text-4xl font-black">{dashboardLoading ? '—' : dashboard?.totalCheckins == null ? '—' : formatNumber(dashboard.totalCheckins)}</p></div><UsersRound className="text-[#f39a4a]" size={25} /></div>
              <div className="mt-5 h-px bg-white/10" />
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-white/55"><span className="h-2 w-2 rounded-full bg-[#55d38a]" /> Live attendance data</div>
            </div>
          </aside>
        </section>

        <Dashboard dashboard={dashboard} loading={dashboardLoading} onRefresh={refreshDashboard} selectedSession={session} />
      </main>

      {confirming && selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#210609]/65 p-4 backdrop-blur-[5px]" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-lg overflow-hidden rounded-[30px] border border-white/20 bg-white shadow-[0_35px_120px_rgba(32,7,10,.3)]">
            <div className="brand-dark relative p-6 sm:p-7">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#e47724]/15 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.25em] text-[#f39a4a]">Final verification</p><h3 id="confirm-title" className="mt-2 font-adero text-3xl font-black uppercase text-white">Confirm check-in</h3></div><button onClick={() => setConfirming(false)} className="rounded-xl bg-white/10 p-2 text-white/70 hover:bg-white/15 hover:text-white" aria-label="Close confirmation"><X size={19} /></button></div>
              <p className="relative mt-3 text-sm text-white/55">You are about to record this attendee for <strong className="text-white">{session}</strong>.</p>
            </div>
            <div className="p-6 sm:p-7">
              <div className="rounded-[22px] border border-[#e9ddd6] bg-[#fbf8f4] p-5">
                <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#8a171d] text-white"><UserRound /></div><div className="min-w-0"><p className="truncate text-xl font-black text-[#2e2724]">{selected.name}</p><p className="mt-0.5 text-xs text-[#897a73]">Registered attendee</p></div></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[['Registration ID', selected.registrationId], ['Check-in code', selected.checkInCode]].map(([label,value]) => <div key={label} className="rounded-2xl border border-[#e7dcd5] bg-white p-3"><span className="block text-[9px] font-black uppercase tracking-[.15em] text-[#a18d84]">{label}</span><div className="mt-1 flex items-center gap-2"><strong className="min-w-0 flex-1 break-all text-sm text-[#8a171d]">{value || 'Not provided'}</strong>{value && <button onClick={() => copyValue(label,value)} className="shrink-0 rounded-lg p-1.5 text-[#9a8b84] hover:bg-[#f7f0eb] hover:text-[#8a171d]" title={`Copy ${label}`}><Copy size={14} /></button>}</div>{copied === label && <span className="mt-1 block text-[9px] font-bold text-[#2f9a63]">Copied</span>}</div>)}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-[22px] bg-[#fff1e5] p-4"><CalendarDays size={19} className="shrink-0 text-[#e47724]" /><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-[#a36a42]">Attendance session</p><p className="mt-1 font-black text-[#8a171d]">{session}</p></div></div>
              <div className="mt-6 grid grid-cols-2 gap-3"><button onClick={() => setConfirming(false)} disabled={loadingCheckin} className="rounded-2xl border border-[#e3d7d0] bg-white px-4 py-3.5 text-sm font-black text-[#6f625b] hover:bg-[#faf7f3]">Go back</button><button onClick={doCheckin} disabled={loadingCheckin} className="flex items-center justify-center gap-2 rounded-2xl bg-[#8a171d] px-4 py-3.5 text-sm font-black text-white hover:bg-[#741218] disabled:cursor-wait disabled:opacity-60">{loadingCheckin ? 'Recording…' : <>Confirm check-in <ArrowRight size={17} /></>}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

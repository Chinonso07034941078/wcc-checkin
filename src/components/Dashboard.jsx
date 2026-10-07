import { Download, RefreshCcw, TrendingUp, UsersRound } from 'lucide-react'
import { SESSIONS } from '../utils/api'

export default function Dashboard({ dashboard, loading, onRefresh, selectedSession }) {
  const counts = dashboard?.sessions || {}
  const exportCsv = () => {
    const rows = [['Session', 'Check-ins'], ...SESSIONS.map(session => [session, counts[session] ?? 0])]
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'wcc-2026-session-summary.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  const peak = Math.max(...SESSIONS.map(s => Number(counts[s] ?? 0)), 0)

  return (
    <section className="mt-6 rounded-[30px] border border-[#e7dcd4] bg-white p-5 shadow-[0_18px_55px_rgba(64,39,28,.05)] sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[.25em] text-[#e47724]">Live operations</p><h2 className="mt-1 font-adero text-2xl font-black uppercase text-[#781319] sm:text-3xl">Attendance overview</h2></div>
        <div className="flex gap-2"><button onClick={onRefresh} className="rounded-xl border border-[#e3d8d1] bg-[#faf7f3] p-3 text-[#766861] hover:text-[#8b171d]" title="Refresh"><RefreshCcw className={loading ? 'animate-spin' : ''} size={17} /></button><button onClick={exportCsv} className="flex items-center gap-2 rounded-xl bg-[#8b171d] px-4 py-3 text-sm font-black text-white hover:bg-[#741218]"><Download size={17} /> Export</button></div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] bg-[#4a090e] p-5 text-white"><UsersRound className="text-[#f39a4a]" size={19} /><p className="mt-3 text-3xl font-black">{loading ? '—' : Number(dashboard?.totalCheckins ?? 0).toLocaleString('en-NG')}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-white/50">Total check-ins</p></div>
        <div className="rounded-[22px] border border-[#eadfd8] bg-[#fff8f2] p-5"><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#a18d84]">Selected session</p><p className="mt-2 text-3xl font-black text-[#8b171d]">{loading ? '—' : counts[selectedSession] ?? 0}</p><p className="mt-1 text-xs font-bold text-[#82736c]">{selectedSession}</p></div>
        <div className="rounded-[22px] border border-[#eadfd8] bg-[#fbf9f6] p-5"><TrendingUp className="text-[#e47724]" size={19} /><p className="mt-3 text-3xl font-black text-[#2f2825]">{loading ? '—' : peak}</p><p className="mt-1 text-xs font-bold text-[#82736c]">highest session attendance...</p></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SESSIONS.map((session, index) => <div key={session} className={`rounded-2xl border p-4 ${session === selectedSession ? 'border-[#b98d79] bg-[#fff6ee]' : 'border-[#eadfd8] bg-[#fffdfb]'}`}><div className="flex items-center justify-between gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#f8e9df] text-[10px] font-black text-[#8b171d]">0{index + 1}</span><span className="text-2xl font-black text-[#2f2825]">{loading ? '—' : counts[session] ?? 0}</span></div><p className="mt-4 text-xs font-bold text-[#6f625b]">{session}</p></div>)}
      </div>
    </section>
  )
}

import { CheckCircle2, Clock3, History, LoaderCircle, Search, UserRound, X } from 'lucide-react'

export default function CheckinCard({ query, setQuery, results, selected, setSelected, loading, history, historyLoading, selectedSession, onCheckin, onClear }) {
  const alreadyChecked = history.some(item => item.session === selectedSession)

  return (
    <div className="mt-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#aa968d]" size={20} />
        <input autoComplete="off" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search registration ID, check-in code or name" className="w-full rounded-[20px] border border-[#ded3cc] bg-white px-14 py-4.5 text-sm font-semibold text-[#2f2825] outline-none placeholder:text-[#b2a49d] transition focus:border-[#8b171d] focus:ring-4 focus:ring-[#8b171d]/10" />
        {query && <button onClick={onClear} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-[#988981] hover:bg-[#f8f3ef] hover:text-[#8b171d]" aria-label="Clear search"><X size={16} /></button>}
      </div>

      {loading && <div className="mt-4 flex items-center gap-2 text-xs font-bold text-[#9b4e27]"><LoaderCircle className="animate-spin" size={15} /> Searching live registrations…</div>}

      {!loading && query && results.length > 0 && !selected && (
        <div className="mt-4 overflow-hidden rounded-[22px] border border-[#e6dbd4] bg-white shadow-[0_10px_35px_rgba(64,39,28,.05)]">
          {results.map(member => (
            <button key={`${member.registrationId}-${member.checkInCode}`} onClick={() => setSelected(member)} className="flex w-full items-center gap-4 border-b border-[#eee6e1] p-4 text-left last:border-0 hover:bg-[#fff8f2]">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f8e9df] text-[#8b171d]"><UserRound size={18} /></div>
              <div className="min-w-0 flex-1"><p className="truncate font-black text-[#2f2825]">{member.name}</p><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-[#8d7d75]"><span>ID: <strong className="text-[#8b171d]">{member.registrationId || '—'}</strong></span><span>Code: <strong>{member.checkInCode || '—'}</strong></span></div></div>
              <span className="text-[#b9a79e]">›</span>
            </button>
          ))}
        </div>
      )}

      {!loading && query && !selected && results.length === 0 && <div className="mt-4 rounded-[22px] border border-[#eadfd8] bg-[#fbf9f6] p-5 text-center"><p className="font-bold text-[#4a403b]">No registration found</p><p className="mt-1 text-xs text-[#95867e]">Try the registration ID, check-in code, or attendee name.</p></div>}

      {selected && (
        <div className="mt-4 rounded-[24px] border border-[#eadfd8] bg-[#fbf9f6] p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#8b171d] text-white"><UserRound /></div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-lg font-black text-[#2f2825]">{selected.name}</h3><span className="rounded-full bg-[#eaf7ef] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide text-[#2f8d5c]">Registered</span></div><div className="mt-3 grid gap-3 text-[10px] font-bold text-[#8a7b73] sm:grid-cols-2"><p>Registration ID<br /><strong className="break-all text-[#8b171d]">{selected.registrationId || '—'}</strong></p><p>Check-in code<br /><strong className="break-all text-[#403732]">{selected.checkInCode || '—'}</strong></p></div></div></div>

          <div className="mt-5 rounded-2xl border border-[#e7dcd5] bg-white p-4">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><History size={15} className="text-[#e47724]" /><p className="text-[9px] font-black uppercase tracking-[.18em] text-[#a18d84]">Attendance history</p></div>{historyLoading && <LoaderCircle className="animate-spin text-[#8b171d]" size={14} />}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {history.length === 0 && !historyLoading && <span className="text-xs font-semibold text-[#9a8c85]">No previous check-ins.</span>}
              {history.map(item => <span key={`${item.session}-${item.timestamp}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#f6eee9] px-2.5 py-1.5 text-[9px] font-black text-[#7b4a3e]"><CheckCircle2 size={11} />{item.session}</span>)}
            </div>
          </div>

          {alreadyChecked ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#f1d79e] bg-[#fff9eb] p-4"><Clock3 className="mt-0.5 shrink-0 text-[#b57a16]" size={18} /><div><p className="text-sm font-black text-[#4c3920]">Already checked in for {selectedSession}</p><p className="mt-1 text-xs leading-5 text-[#806d53]">This attendee can still check in during another session.</p></div></div>
          ) : (
            <button disabled={loading || historyLoading} onClick={onCheckin} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#8b171d] px-5 py-4 text-sm font-black text-white transition hover:bg-[#741218] disabled:cursor-wait disabled:opacity-60"><CheckCircle2 size={19} /> Confirm check-in for {selectedSession}</button>
          )}
          <button onClick={() => setSelected(null)} className="mt-2 w-full py-2 text-xs font-bold text-[#8e7f77] hover:text-[#8b171d]">Choose a different person</button>
        </div>
      )}
    </div>
  )
}

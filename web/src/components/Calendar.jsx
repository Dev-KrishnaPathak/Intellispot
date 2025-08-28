import React, { useMemo, useState, useEffect } from 'react'


export default function Calendar({
  events = [],
  value,
  onMonthChange,
  onDayClick,
  startWeekOn = 'mon',
  renderEventItem,
  onAddClick,
  onDeleteEvent,
}) {
  const today = new Date()
  const [visibleMonth, setVisibleMonth] = useState(() =>
    value ? new Date(value.getFullYear(), value.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const [panelDate, setPanelDate] = useState(null)

  useEffect(() => {
    if (value) {
      setVisibleMonth(new Date(value.getFullYear(), value.getMonth(), 1))
    }
  }, [value?.getFullYear, value?.getMonth])

  useEffect(() => {
    if (onMonthChange) onMonthChange(visibleMonth)
  }, [visibleMonth?.getFullYear, visibleMonth?.getMonth])

  const firstDayOfGrid = useMemo(() => {
    const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    const day = firstOfMonth.getDay() 
    const weekStart = startWeekOn === 'mon' ? 1 : 0
    const shift = ((day - weekStart + 7) % 7)
    const d = new Date(firstOfMonth)
    d.setDate(firstOfMonth.getDate() - shift)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }, [visibleMonth, startWeekOn])

  const weeks = useMemo(() => {
    const days = []
    for (let i = 0; i < 42; i++) { 
      const d = new Date(firstDayOfGrid)
      d.setDate(firstDayOfGrid.getDate() + i)
      days.push(d)
    }
    const chunks = []
    for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7))
    return chunks
  }, [firstDayOfGrid])

  const isSameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const isSameMonth = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()

  const weekdays = startWeekOn === 'mon'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const eventsByDay = useMemo(() => {
    const map = new Map()
    for (const ev of events) {
      if (!ev?.date) continue
      const key = ev.date
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(ev)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    }
    return map
  }, [events])

  const fmtYYYYMMDD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(visibleMonth)

  const openPanel = (d) => {
    setPanelDate(d)
    if (onDayClick) onDayClick(d, eventsByDay.get(fmtYYYYMMDD(d)) || [])
  }

  const closePanel = () => setPanelDate(null)

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            aria-label="Previous month"
            onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
            className="rounded-full border border-gray-300 w-8 h-8 flex items-center justify-center hover:bg-gray-50"
          >
            <span className="sr-only">Prev</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button
            aria-label="Next month"
            onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
            className="rounded-full border border-gray-300 w-8 h-8 flex items-center justify-center hover:bg-gray-50"
          >
            <span className="sr-only">Next</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
        <div className="text-lg md:text-xl font-semibold text-gray-900 select-none">
          {monthLabel}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="text-xs md:text-sm rounded-full border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
          >
            Today
          </button>
          <button
            aria-label="Add schedule"
            onClick={() => onAddClick && onAddClick()}
            className="rounded-full w-8 h-8 flex items-center justify-center border border-gray-300 text-gray-800 hover:bg-gray-50"
            title="Add schedule"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7">
        {weekdays.map((w) => (
          <div key={w} className="bg-white text-[11px] md:text-xs text-gray-500 uppercase tracking-wide text-center py-2">
            {w[0]}
          </div>
        ))}
      </div>

      {/* Month grid: per-week rows with plain horizontal lines */}
      <div className="max-h-[70vh] overflow-y-auto md:max-h-none md:overflow-visible">
        {weeks.map((week, wi) => (
          <div key={wi} className={`${wi === 0 ? '' : 'border-t border-gray-200'} grid grid-cols-7`}>
            {week.map((d, di) => {
              const inMonth = isSameMonth(d, visibleMonth)
              const key = fmtYYYYMMDD(d)
              const dayEvents = eventsByDay.get(key) || []
              const isToday = isSameDay(d, today)
              return (
                <button
                  key={di + '-' + key}
                  className={`bg-white p-2 md:p-3 min-h-[80px] md:min-h-[110px] flex flex-col items-start rounded-lg text-left relative hover:shadow-sm transition ${inMonth ? '' : 'opacity-50'} `}
                  onClick={() => openPanel(d)}
                >
                  {/* date badge */}
                  <div className="mb-1 w-full flex justify-center">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${isToday ? 'bg-black text-white' : 'text-gray-900'}`}>
                      {d.getDate()}
                    </span>
                  </div>

                  {/* event pills (up to 2) with title text */}
                  <div className="mt-auto w-full space-y-1">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        title={ev.title}
                        className="w-full rounded-md px-2 py-0.5 text-[10px] leading-4 text-white truncate"
                        style={{ backgroundColor: ev.color || '#2563eb' }}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-gray-500">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Modal with full event list */}
      <div className={`fixed inset-0 z-40 ${panelDate ? '' : 'pointer-events-none'}`}>
        {/* backdrop */}
        <div
          onClick={closePanel}
          className={`absolute inset-0 bg-black/30 transition-opacity ${panelDate ? 'opacity-100' : 'opacity-0'}`}
        />
        {/* modal */}
        <div className={`absolute inset-0 flex items-center justify-center transition ${panelDate ? '' : 'opacity-0 scale-95'}`}>
          <div className="w-[92%] max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="font-semibold text-gray-900">
                {panelDate ? new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(panelDate) : ''}
              </div>
              <button onClick={closePanel} className="rounded-full border border-gray-300 w-8 h-8 flex items-center justify-center hover:bg-gray-50">
                <span className="sr-only">Close</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {(eventsByDay.get(panelDate ? fmtYYYYMMDD(panelDate) : '') || []).length === 0 ? (
                <div className="text-sm text-gray-500">No events.</div>
              ) : (
                (eventsByDay.get(panelDate ? fmtYYYYMMDD(panelDate) : '') || []).map((ev) => (
                  <div key={ev.id} className="rounded-xl border border-gray-100 p-3 flex items-start gap-3 hover:shadow-sm transition">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mt-1.5" style={{ backgroundColor: ev.color || '#2563eb' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{ev.title}</div>
                      {ev.time && <div className="text-xs text-gray-500 mt-0.5">{ev.time}</div>}
                      {renderEventItem ? renderEventItem({ event: ev }) : null}
                    </div>
                    {onDeleteEvent && (
                      <button
                        type="button"
                        onClick={() => onDeleteEvent(ev)}
                        className="shrink-0 rounded-full border border-red-300 text-red-700 text-xs px-2 py-1 hover:bg-red-50"
                        title="Delete this event"
                      >Delete</button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

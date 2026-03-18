'use client';

import { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { authHeader, dashboardApiUrl } from '@/lib/api-client';

export type DateRangeValue = { start: string; end: string } | null;

type LotStatusDatePickerProps = {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  minDate: string | null;
  maxDate: string | null;
  language: string;
};

export default function LotStatusDatePicker({ value, onChange, minDate, maxDate, language }: LotStatusDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempStart, setTempStart] = useState<string | null>(null);
  const [tempEnd, setTempEnd] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() =>
    value?.start ? dayjs(value.start).format('YYYY-MM') : dayjs().format('YYYY-MM')
  );
  const [datesWithData, setDatesWithData] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTempStart(value?.start ?? null);
      setTempEnd(value?.end ?? null);
      setViewMonth(value?.start ? dayjs(value.start).format('YYYY-MM') : dayjs().format('YYYY-MM'));
    }
  }, [open, value?.start, value?.end]);

  useEffect(() => {
    if (!open) return;
    const [y, m] = viewMonth.split('-').map(Number);
    fetch(dashboardApiUrl(`/api/dashboard/lot-status-dates-in-month?year=${y}&month=${m}`), {
      cache: 'no-store',
      headers: authHeader(),
    })
      .then((r) => r.json().catch(() => ({ success: false, dates: [] })))
      .then((json) => {
        if (json?.success && Array.isArray(json.dates)) {
          setDatesWithData(new Set(json.dates.map((d: string) => String(d).slice(0, 10))));
        } else {
          setDatesWithData(new Set());
        }
      })
      .catch(() => setDatesWithData(new Set()));
  }, [open, viewMonth]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [open]);

  const view = dayjs(viewMonth + '-01');
  const startOfMonth = view.startOf('month');
  const endOfMonth = view.endOf('month');
  const startPad = startOfMonth.day();
  const daysInMonth = endOfMonth.date();
  const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7;

  const dayLabels = language === 'ko' ? ['일', '월', '화', '수', '목', '금', '토'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => setViewMonth(view.add(-1, 'month').format('YYYY-MM'));
  const nextMonth = () => setViewMonth(view.add(1, 'month').format('YYYY-MM'));

  const canPrev = minDate && viewMonth <= minDate.slice(0, 7);
  const canNext = maxDate && viewMonth >= maxDate.slice(0, 7);

  const handleDateClick = (dateStr: string) => {
    if (!tempStart) {
      setTempStart(dateStr);
      return;
    }
    if (tempStart === dateStr) {
      setTempStart(null);
      return;
    }
    if (tempEnd === dateStr) {
      setTempEnd(null);
      return;
    }
    if (tempEnd) {
      setTempEnd(null);
      setTempStart(dateStr);
      return;
    }
    setTempEnd(dateStr);
  };

  const handleConfirm = () => {
    if (!tempStart) {
      onChange(null);
    } else {
      const [start, end] = tempEnd
        ? [tempStart, tempEnd].sort()
        : [tempStart, tempStart];
      onChange({ start, end });
    }
    setOpen(false);
  };

  const isInRange = (dateStr: string) => {
    if (!tempStart) return false;
    const [a, b] = tempEnd ? [tempStart, tempEnd].sort() : [tempStart, tempStart];
    return dateStr >= a && dateStr <= b;
  };

  const isStartOrEnd = (dateStr: string) =>
    dateStr === tempStart || dateStr === tempEnd;

  return (
    <div className="relative isolate" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white min-w-[200px] text-left"
      >
        {value
          ? value.start === value.end
            ? value.start
            : `${value.start} ~ ${value.end}`
          : (language === 'ko' ? '날짜 선택' : 'Select date')}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-[100] bg-white border border-slate-200 rounded-lg shadow-xl p-4 w-[288px]">
          <div className="flex items-center gap-1 mb-3">
            <button
              type="button"
              onClick={prevMonth}
              disabled={!!canPrev}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
            >
              ←
            </button>
            <span className="flex-1 text-base font-semibold text-slate-800 text-center">
              {view.format(language === 'ko' ? 'YYYY년 M월' : 'MMM YYYY')}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              disabled={!!canNext}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
            >
              →
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="ml-1 px-2 py-1 text-xs font-medium bg-slate-700 text-white rounded hover:bg-slate-600"
            >
              {language === 'ko' ? '확인' : 'OK'}
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-sm">
            {dayLabels.map((l) => (
              <div key={l} className="flex items-center justify-center h-9 min-w-0 text-slate-600 font-medium">
                {l}
              </div>
            ))}
            {Array.from({ length: totalCells }, (_, i) => {
              const dayNum = i - startPad + 1;
              if (dayNum < 1 || dayNum > daysInMonth) {
                return <div key={i} className="h-9" />;
              }
              const d = view.date(dayNum);
              const dateStr = d.format('YYYY-MM-DD');
              const hasData = datesWithData.has(dateStr);
              const inSelectRange = isInRange(dateStr);
              const isStartOrEndDate = isStartOrEnd(dateStr);
              const isInBounds =
                (!minDate || dateStr >= minDate) && (!maxDate || dateStr <= maxDate);
              const canSelect = isInBounds;

              return (
                <button
                  key={i}
                  type="button"
                  disabled={!canSelect}
                  onClick={() => canSelect && handleDateClick(dateStr)}
                  className={`w-full h-9 min-w-0 rounded flex flex-col items-center justify-center gap-0.5 ${
                    !canSelect
                      ? 'text-slate-300 cursor-not-allowed'
                      : isStartOrEndDate
                        ? 'bg-slate-800 text-white'
                        : inSelectRange
                          ? 'bg-slate-200 text-slate-800'
                          : 'hover:bg-slate-100 text-slate-800'
                  }`}
                  title={!canSelect ? (language === 'ko' ? '선택 불가' : 'Not available') : hasData ? (language === 'ko' ? '데이터 있음' : 'Has data') : undefined}
                >
                  <span>{dayNum}</span>
                  {canSelect && hasData && !inSelectRange && !isStartOrEndDate && (
                    <span className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

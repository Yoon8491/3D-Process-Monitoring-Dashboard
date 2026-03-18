'use client';

import { useState } from 'react';
import { useProcessCalendarWeek } from '@/hooks/useProcessCalendarWeek';

type DayData = { date: string; production: number; defectRate: number };

function getMondayOfWeek(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7; // Mon=0, Sun=6
  date.setDate(date.getDate() - diff);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dayNum = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

type Props = {
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  language: string;
  minDate?: string | null;
  maxDate?: string | null;
};

/** 공정 현황(대시보드)과 동일한 생산량/불량률 데이터 소스(useProcessCalendarWeek) 사용 */
export default function WeeklyCalendar({ selectedDate, onDateSelect, language, minDate, maxDate }: Props) {
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const { days, productionUnit, productionUnitEn, loading, error } = useProcessCalendarWeek(weekStart);
  const unit = language === 'ko' ? productionUnit : productionUnitEn;

  const goPrev = () => {
    setWeekStart((prev) => addDays(prev, -7));
  };

  const goNext = () => {
    setWeekStart((prev) => addDays(prev, 7));
  };

  const canGoPrev = !minDate || weekStart > minDate;
  const weekEnd = addDays(weekStart, 6);
  const canGoNext = !maxDate || weekEnd < maxDate;

  const formatDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const today = new Date();
    const isToday = dateStr === (today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0'));
    return isToday ? (language === 'ko' ? `오늘 (${m}/${day})` : `Today (${m}/${day})`) : `${m}/${day}`;
  };

  /** 공정 현황 캘린더와 동일: kg 단위는 소수 3자리(예: 317.617), 그 외는 기존 포맷 */
  const formatProductionDisplay = (v: number) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return '0';
    const isKg = unit.toLowerCase() === 'kg';
    if (isKg) return n.toFixed(3);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(Math.round(n));
  };

  const safeDefectRate = (d: DayData) => {
    const r = Number(d.defectRate);
    return Number.isFinite(r) ? r : 0;
  };

  const safeProduction = (d: DayData) => {
    const p = Number(d.production);
    return Number.isFinite(p) ? p : 0;
  };

  if (error && days.length === 0) {
    return (
      <div className="w-full flex items-center justify-center gap-2 py-4 px-3 border border-slate-200 rounded-lg bg-slate-50 min-h-[96px]">
        <span className="text-sm text-amber-600">{error}</span>
      </div>
    );
  }

  if (loading && days.length === 0) {
    return (
      <div className="w-full flex items-center justify-center gap-2 py-4 px-3 border border-slate-200 rounded-lg bg-slate-50 min-h-[96px]">
        <span className="text-sm text-slate-500">{language === 'ko' ? '주간 데이터 로딩 중...' : 'Loading...'}</span>
      </div>
    );
  }

  return (
    <div className="w-full flex items-stretch gap-2 py-3 px-3 border border-slate-200 rounded-lg bg-slate-50 min-h-[96px]">
      <button
        type="button"
        onClick={goPrev}
        disabled={!canGoPrev}
        className="shrink-0 w-10 h-auto min-h-[72px] flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={language === 'ko' ? '이전 주' : 'Previous week'}
      >
        <span className="text-xl leading-none">←</span>
      </button>
      <div className="flex-1 grid grid-cols-7 gap-2 min-w-0 w-full">
        {days.map((day) => {
          const isSelected = selectedDate === day.date;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onDateSelect(day.date)}
              className={`flex flex-col items-center justify-center py-3 px-2 rounded-lg border text-center min-w-0 min-h-[80px] ${
                isSelected
                  ? 'border-slate-700 bg-slate-700 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="text-sm font-semibold opacity-95 truncate w-full">{formatDayLabel(day.date)}</span>
              <div className={`mt-1.5 text-xs text-center ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                <div>{language === 'ko' ? '생산량' : 'Production'}: {formatProductionDisplay(safeProduction(day))} {unit}</div>
                <div className={safeDefectRate(day) > 3 ? (isSelected ? 'text-red-300 font-medium' : 'text-red-600 font-medium') : ''}>
                  {language === 'ko' ? '불량률' : 'Defect'}: {safeDefectRate(day).toFixed(1)}%
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={goNext}
        disabled={!canGoNext}
        className="shrink-0 w-10 h-auto min-h-[72px] flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={language === 'ko' ? '다음 주' : 'Next week'}
      >
        <span className="text-xl leading-none">→</span>
      </button>
    </div>
  );
}

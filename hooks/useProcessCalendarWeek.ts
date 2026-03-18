'use client';

import { useEffect, useState, useCallback } from 'react';
import { dashboardApiUrl, authHeader } from '@/lib/api-client';

/** 공정 현황(대시보드) 캘린더와 동일한 데이터 소스: 일별 총 생산량·평균 불량률 */
export type ProcessCalendarDay = { date: string; production: number; defectRate: number };

export type ProcessCalendarWeekResult = {
  days: ProcessCalendarDay[];
  productionUnit: string;
  productionUnitEn: string;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * 주간(7일) 공정 캘린더 데이터.
 * calendar-month와 동일한 getProcessDataTable/getProcessColumnMap 기반 API(calendar-week) 사용.
 * LOT별 공정 현황 주간 캘린더와 공정 현황 월간 캘린더가 같은 생산량/불량률 로직을 공유하도록 함.
 */
export function useProcessCalendarWeek(weekStart: string): ProcessCalendarWeekResult {
  const [days, setDays] = useState<ProcessCalendarDay[]>([]);
  const [productionUnit, setProductionUnit] = useState('개');
  const [productionUnitEn, setProductionUnitEn] = useState('ea');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeek = useCallback(async (start: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(dashboardApiUrl(`/api/dashboard/calendar-week?start=${encodeURIComponent(start)}`), {
        cache: 'no-store',
        headers: authHeader(),
      });
      const json = await res.json().catch(() => null);
      if (json?.success && Array.isArray(json.days)) {
        const normalized: ProcessCalendarDay[] = json.days.map((d: any) => ({
          date: String(d?.date ?? ''),
          production: Number(d?.production ?? d?.production_amount ?? 0) || 0,
          defectRate: Number(d?.defectRate ?? d?.defect_rate ?? 0) || 0,
        }));
        setDays(normalized);
        setProductionUnit(json.productionUnit ?? '개');
        setProductionUnitEn(json.productionUnitEn ?? 'ea');
      } else {
        setDays([]);
        setError(json?.error ?? 'Failed to load');
      }
    } catch (e) {
      setDays([]);
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeek(weekStart);
  }, [weekStart, fetchWeek]);

  return {
    days,
    productionUnit,
    productionUnitEn,
    loading,
    error,
    refetch: () => fetchWeek(weekStart),
  };
}

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Card from '@/components/Card';
import { useLanguage } from '@/contexts/LanguageContext';
import { authHeader, dashboardApiUrl } from '@/lib/api-client';

type HistoryItem = {
  time: string;
  raw_data?: Record<string, number | string> | string;
  simulation_results?: Record<string, number | string> | string;
  preprocessing?: Record<string, number | string> | string;
  [key: string]: string | number | Record<string, number | string> | undefined;
};
type SensorInfo = { name: string; nameKorean: string; unit: string };

type MetricOption = 'humidity' | 'tank_pressure' | 'temperature';

const CHART_PAD = { left: 56, right: 56, top: 24, bottom: 40 };
const CHART_VIEW = { width: 800, height: 360 };

function smoothPathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  const tension = 0.35;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
    const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
    const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
    const cp2y = p2.y - (p3.y - p1.y) * tension / 3;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x} ${p2.y}`;
  }
  return d;
}

export type SensorChartContentProps = {
  /** 제목/부제목 표시 여부 (설비 모니터링 내 임베드 시 false 가능) */
  showTitle?: boolean;
  /** 설비 클릭 후 차트로 전환된 경우 표시할 설비명 */
  selectedEquipmentName?: string | null;
  /** 해당 설비 데이터 로드용 설비 ID (상세 차트 보기 시 전달) */
  equipmentId?: string | null;
};

export default function SensorChartContent({ showTitle = true, selectedEquipmentName = null, equipmentId = null }: SensorChartContentProps = {}) {
  const { language } = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sensors, setSensors] = useState<SensorInfo[]>([]);
  const [rawDataForIqr, setRawDataForIqr] = useState<Record<string, number[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricOption>('humidity');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const [hover, setHover] = useState<{
    index: number;
    x: number;
    y: number;
    value: number;
    time: string;
    mouseX: number;
  } | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ history: 'true', period: 'day', date: selectedDate, iqr: 'all' });
    if (equipmentId) params.set('equipmentId', equipmentId);
    fetch(dashboardApiUrl(`/api/dashboard/realtime?${params.toString()}`), { headers: authHeader() })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.success) {
          setHistory(json.history ?? []);
          setRawDataForIqr(json.rawDataForIqr ?? null);
          const sensorList = (json.sensors ?? []).map((s: { name: string; nameKorean: string; unit: string }) => ({
            name: s.name,
            nameKorean: s.nameKorean,
            unit: s.unit,
          }));
          setSensors(sensorList);
        } else {
          setHistory([]);
          setRawDataForIqr(null);
          setSensors([]);
          setError(json?.error || 'Failed to load');
        }
      })
      .catch((err) => {
        setError(String(err?.message || err));
        setHistory([]);
        setRawDataForIqr(null);
        setSensors([]);
      })
      .finally(() => setLoading(false));
  }, [selectedDate, equipmentId]);

  useEffect(() => {
    setPinnedIndex(null);
  }, [selectedDate, selectedMetric]);

  useEffect(() => {
    const [y, m] = selectedDate.split('-').map(Number);
    setCalendarMonth({ year: y, month: m });
  }, [selectedDate]);

  const humidityCol = sensors.find((s) => /humidity/i.test(s.name));
  const tankPressureCol = sensors.find((s) => /tank_pressure|tank.?pressure/i.test(s.name));
  const temperatureCol = sensors.find((s) => /temperature|temp/i.test(s.name));

  const activeCol =
    selectedMetric === 'humidity'
      ? humidityCol
      : selectedMetric === 'tank_pressure'
        ? tankPressureCol
        : temperatureCol;

  const getRowVal = (h: HistoryItem, key: string): number => {
    const v = h[key];
    if (v !== undefined && v !== null && typeof v !== 'object') return Number(v);
    const lower = key.toLowerCase();
    const found = Object.keys(h).find((k) => k.toLowerCase() === lower && typeof h[k] !== 'object');
    return found != null ? Number(h[found]) : NaN;
  };

  const getMetricFromObj = (obj: Record<string, unknown> | undefined, metricName: string): number => {
    if (!obj || typeof obj !== 'object') return NaN;
    const v = obj[metricName];
    if (v !== undefined && v !== null) return Number(v);
    const lower = metricName.toLowerCase();
    const found = Object.keys(obj).find((k) => k.toLowerCase() === lower);
    return found != null ? Number(obj[found]) : NaN;
  };

  const ensureObj = (h: HistoryItem, key: 'raw_data' | 'simulation_results' | 'preprocessing'): Record<string, unknown> | undefined => {
    const raw = h[key];
    if (raw == null) return undefined;
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return parsed && typeof parsed === 'object' ? parsed : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  const baseKey = activeCol ? activeCol.name : '';
  const preprocessingKeyCandidates = (): string[] => {
    if (!activeCol) return [];
    const n = activeCol.name.toLowerCase();
    if (/humidity/i.test(n)) return [activeCol.name, 'humidity', 'Humidity'];
    if (/tank_pressure|pressure/i.test(n)) return [activeCol.name, 'tank_pressure', 'TankPressure'];
    if (/temp|temperature|sintering/i.test(n)) return [activeCol.name, 'sintering_temp', 'temperature', 'temp', 'Temperature'];
    return [activeCol.name];
  };
  const keyCandidates = preprocessingKeyCandidates();

  const getPreprocessingValue = (obj: Record<string, unknown> | undefined): number => {
    if (!obj || typeof obj !== 'object') return NaN;
    for (const key of keyCandidates) {
      const v = obj[key];
      if (v !== undefined && v !== null && !Number.isNaN(Number(v))) return Number(v);
    }
    for (const key of Object.keys(obj)) {
      if (keyCandidates.some((c) => c.toLowerCase() === key.toLowerCase())) {
        const v = obj[key];
        if (v !== undefined && v !== null && !Number.isNaN(Number(v))) return Number(v);
      }
    }
    return NaN;
  };

  const rawSimulation = history.length > 0 && activeCol
    ? history.map((h) => {
        const obj = ensureObj(h, 'simulation_results');
        const fromObj = getMetricFromObj(obj, baseKey);
        if (!Number.isNaN(fromObj)) return fromObj;
        return Number(getRowVal(h, baseKey) || 0);
      })
    : [];
  const rawDataValues = history.length > 0 && activeCol
    ? history.map((h) => {
        const obj = ensureObj(h, 'raw_data');
        const fromObj = getMetricFromObj(obj, baseKey);
        if (!Number.isNaN(fromObj)) return fromObj;
        return Number(getRowVal(h, baseKey) || 0);
      })
    : [];

  const isSentinelValue = (v: number) => !Number.isFinite(v) || v <= -100 || v === -999 || v === -9999;
  const clampHumidity = (v: number) => {
    if (!(activeCol && selectedMetric === 'humidity')) return v;
    if (isSentinelValue(v)) return v;
    return Math.max(0, Math.min(100, v));
  };
  const simulationResults = rawSimulation.map(clampHumidity);
  const rawData = rawDataValues.map(clampHumidity);

  const rawPreprocessed = history.length > 0 && activeCol
    ? history.map((h, i) => {
        const obj = ensureObj(h, 'preprocessing');
        const fromPrep = getPreprocessingValue(obj);
        if (Number.isFinite(fromPrep)) return fromPrep;
        return simulationResults[i] ?? Number(getRowVal(h, baseKey) || 0);
      })
    : [];
  const preprocessedValues = rawPreprocessed.length > 0 ? rawPreprocessed.map(clampHumidity) : simulationResults;
  const hasPreprocessing =
    history.length > 0 &&
    activeCol &&
    history.some((h) => Number.isFinite(getPreprocessingValue(ensureObj(h, 'preprocessing'))));

  const values = hasPreprocessing ? preprocessedValues : simulationResults;
  const times = history.map((h) => h.time);

  const { lowerBoundIQR, upperBoundIQR } = (() => {
    const baseKeyForIqr = activeCol?.name ?? '';
    const rawForIqr =
      baseKeyForIqr && rawDataForIqr?.[baseKeyForIqr]?.length >= 4
        ? rawDataForIqr[baseKeyForIqr]
        : hasPreprocessing ? preprocessedValues : rawDataValues;
    const forIqr = rawForIqr
      .filter((v) => Number.isFinite(v) && !isSentinelValue(v));
    if (forIqr.length < 4) return { lowerBoundIQR: null as number | null, upperBoundIQR: null as number | null };
    const sorted = [...forIqr].sort((a, b) => a - b);
    const n = sorted.length;
    const percentile = (p: number): number => {
      const idx = (n - 1) * p;
      const lo = Math.floor(idx);
      const hi = Math.min(n - 1, Math.ceil(idx));
      const frac = idx - lo;
      const a = sorted[lo] ?? 0;
      const b = sorted[hi] ?? a;
      return a + frac * (b - a);
    };
    const Q1 = percentile(0.25);
    const Q3 = percentile(0.75);
    const IQR = Q3 - Q1 || 1e-9;
    const IQR_MULTIPLIER = 1.98;
    let lower = Q1 - IQR_MULTIPLIER * IQR;
    let upper = Q3 + IQR_MULTIPLIER * IQR;
    if (lower < 0) lower = 0;
    return { lowerBoundIQR: lower, upperBoundIQR: upper };
  })();

  const simDiffPrepIndices = new Set<number>(
    hasPreprocessing && activeCol
      ? history
          .map((h, i) => {
            const prepObj = ensureObj(h, 'preprocessing');
            const simObj = ensureObj(h, 'simulation_results');
            const prepVal = getPreprocessingValue(prepObj);
            const simVal = getMetricFromObj(simObj, baseKey);
            if (!Number.isFinite(prepVal) || !Number.isFinite(simVal)) return -1;
            return Math.abs(prepVal - simVal) > 1e-9 ? i : -1;
          })
          .filter((i) => i >= 0)
      : []
  );
  const redDotIndices = new Set<number>(simDiffPrepIndices);
  const getRedDotValue = (i: number) =>
    redDotIndices.has(i) ? simulationResults[i] : values[i];

  const chartW = CHART_VIEW.width - CHART_PAD.left - CHART_PAD.right;
  const chartH = CHART_VIEW.height - CHART_PAD.top - CHART_PAD.bottom;
  const allValues = [
    ...values.filter((v, i) => !redDotIndices.has(i)),
    ...(lowerBoundIQR != null ? [lowerBoundIQR] : []),
    ...(upperBoundIQR != null ? [upperBoundIQR] : []),
  ].filter((v) => Number.isFinite(v));
  let dataMax = allValues.length ? Math.max(...allValues) : 0;
  let dataMin = allValues.length ? Math.min(...allValues) : 0;
  if (selectedMetric === 'humidity' && dataMax === 100) {
    const valsOnly = values.filter((v) => Number.isFinite(v));
    const realMax = valsOnly.length ? Math.max(...valsOnly) : 0;
    const realMin = valsOnly.length ? Math.min(...valsOnly) : 0;
    if (realMax < 50) {
      dataMax = Math.max(realMax, upperBoundIQR === 100 ? realMax : (upperBoundIQR ?? realMax)) + 10;
      dataMin = Math.min(realMin, lowerBoundIQR ?? realMin);
    }
  }
  const dataRange = dataMax - dataMin || 1;
  const yPadding = Math.max(dataRange * 0.45, dataRange * 0.2 + 0.5, 0.5);
  let displayMin = dataMin - yPadding;
  let displayMax = dataMax + yPadding;
  if (selectedMetric === 'humidity') {
    displayMin = Math.max(-10, dataMin - yPadding);
    displayMax = Math.min(100, displayMax);
    if (displayMax - displayMin < 10) displayMax = Math.min(100, displayMin + 10);
  }
  const displayRange = displayMax - displayMin;

  const yTicks = (() => {
    const count = 6;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) ticks.push(displayMin + (displayRange * i) / count);
    return ticks;
  })();

  const xTickIndices = (() => {
    const count = 6;
    if (values.length <= 1) return [];
    const indices: number[] = [];
    for (let i = 0; i <= count; i++) indices.push(Math.round((i / count) * (values.length - 1)));
    return indices;
  })();

  const valueToY = useCallback(
    (v: number) => CHART_PAD.top + chartH - ((v - displayMin) / displayRange) * chartH,
    [displayMin, displayRange, chartH]
  );
  const indexToX = useCallback(
    (i: number) =>
      values.length <= 1
        ? CHART_PAD.left + chartW / 2
        : CHART_PAD.left + (i / Math.max(1, values.length - 1)) * chartW,
    [values.length, chartW]
  );

  const handleChartMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || values.length === 0) return;
      let svgX: number; let svgY: number;
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const svgPt = pt.matrixTransform(ctm.inverse());
        svgX = svgPt.x; svgY = svgPt.y;
      } else {
        const rect = svg.getBoundingClientRect();
        svgX = ((e.clientX - rect.left) / rect.width) * CHART_VIEW.width;
        svgY = ((e.clientY - rect.top) / rect.height) * CHART_VIEW.height;
      }
      const inChart = svgX >= CHART_PAD.left && svgX <= CHART_PAD.left + chartW && svgY >= CHART_PAD.top && svgY <= CHART_PAD.top + chartH;
      if (!inChart) { setHover(null); return; }
      const relX = svgX - CHART_PAD.left;
      const idx = values.length <= 1 ? 0 : Math.round((relX / chartW) * (values.length - 1));
      const clampedIdx = Math.max(0, Math.min(idx, values.length - 1));
      const v = values[clampedIdx];
      setHover({ index: clampedIdx, x: indexToX(clampedIdx), y: valueToY(v), value: v, time: times[clampedIdx] ?? '', mouseX: Math.max(CHART_PAD.left, Math.min(CHART_PAD.left + chartW, svgX)) });
    },
    [values, times, indexToX, valueToY, chartW, chartH]
  );
  const handleChartMouseLeave = useCallback(() => setHover(null), []);
  const handleChartClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || values.length === 0) return;
      const ctm = svg.getScreenCTM();
      let svgX: number; let svgY: number;
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const svgPt = pt.matrixTransform(ctm.inverse());
        svgX = svgPt.x; svgY = svgPt.y;
      } else {
        const rect = svg.getBoundingClientRect();
        svgX = ((e.clientX - rect.left) / rect.width) * CHART_VIEW.width;
        svgY = ((e.clientY - rect.top) / rect.height) * CHART_VIEW.height;
      }
      const inChart = svgX >= CHART_PAD.left && svgX <= CHART_PAD.left + chartW && svgY >= CHART_PAD.top && svgY <= CHART_PAD.top + chartH;
      if (inChart) {
        const relX = svgX - CHART_PAD.left;
        const idx = values.length <= 1 ? 0 : Math.round((relX / chartW) * (values.length - 1));
        const clampedIdx = Math.max(0, Math.min(idx, values.length - 1));
        setPinnedIndex((prev) => (prev === clampedIdx ? null : clampedIdx));
      } else setPinnedIndex(null);
    },
    [values.length, chartW, chartH]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pinnedIndex === null) return;
      if (e.key === 'ArrowLeft') { setPinnedIndex((i) => (i === null ? null : Math.max(0, i - 1))); e.preventDefault(); }
      if (e.key === 'ArrowRight') { setPinnedIndex((i) => (i === null ? null : Math.min(values.length - 1, (i ?? 0) + 1))); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinnedIndex, values.length]);

  const formatTimeOnly = (timeStr: string) => {
    try {
      const d = new Date(timeStr);
      return d.toLocaleTimeString(language === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return '-'; }
  };

  const calendarDays = (() => {
    const { year, month } = calendarMonth;
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const startPad = first.getDay();
    const daysInMonth = last.getDate();
    const total = startPad + daysInMonth;
    const rows = Math.ceil(total / 7);
    const cells: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    const remainder = rows * 7 - cells.length;
    for (let i = 0; i < remainder; i++) cells.push(null);
    return cells;
  })();

  const titleKo = '습도·탱크 압력·온도 추이';
  const titleEn = 'Humidity, Tank Pressure & Temperature Trend';
  const subtitleKo = '그래프는 preprocessing(전처리) 값으로 그리고, simulation_result와 다를 때만 빨간 점으로 표시합니다. 상·하한선은 data_sample 전체 기준 IQR 1.98입니다.';
  const subtitleEn = 'Graph uses preprocessing values; red dots show simulation_result only when it differs. Upper/lower bounds are IQR 1.98 from data_sample.';

  const displayPoint =
    pinnedIndex !== null && values.length > 0
      ? (() => {
          const i = Math.max(0, Math.min(pinnedIndex, values.length - 1));
          const isRed = redDotIndices.has(i);
          const yPos = isRed ? Math.max(CHART_PAD.top, Math.min(CHART_PAD.top + chartH, valueToY(getRedDotValue(i)))) : valueToY(values[i]);
          return { index: i, x: indexToX(i), y: yPos, value: values[i], time: times[i] ?? '', mouseX: indexToX(i) };
        })()
      : hover;

  return (
    <div className="max-w-full mx-auto">
      {showTitle && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">
            {language === 'ko' ? titleKo : titleEn}
          </h2>
          <p className="text-slate-600 mt-1">
            {language === 'ko' ? subtitleKo : subtitleEn}
          </p>
        </div>
      )}
      {selectedEquipmentName && (
        <p className="mb-4 text-sm text-slate-600">
          {language === 'ko' ? '선택된 설비' : 'Selected equipment'}: <span className="font-medium text-slate-900">{selectedEquipmentName}</span>
        </p>
      )}
      {loading ? (
        <div className="py-12 text-center text-slate-500">
          {language === 'ko' ? '로딩 중...' : 'Loading...'}
        </div>
      ) : error ? (
        <div className="py-6 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      ) : (
        <Card
          title={
            activeCol
              ? `${activeCol.nameKorean} (${activeCol.unit ?? (language === 'ko' ? '시간' : 'Time')})`
              : language === 'ko' ? '데이터 없음' : 'No Data'
          }
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelectedMetric('humidity')} className={`px-3 py-2 rounded-md text-sm font-medium ${selectedMetric === 'humidity' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {humidityCol ? humidityCol.nameKorean : '습도'} ({humidityCol ? humidityCol.unit : '%'})
              </button>
              <button type="button" onClick={() => setSelectedMetric('tank_pressure')} className={`px-3 py-2 rounded-md text-sm font-medium ${selectedMetric === 'tank_pressure' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {tankPressureCol ? tankPressureCol.nameKorean : '탱크 압력'} ({tankPressureCol ? tankPressureCol.unit : 'kPa'})
              </button>
              <button type="button" onClick={() => setSelectedMetric('temperature')} className={`px-3 py-2 rounded-md text-sm font-medium ${selectedMetric === 'temperature' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {temperatureCol ? temperatureCol.nameKorean : (language === 'ko' ? '온도' : 'Temperature')} ({temperatureCol ? temperatureCol.unit : '°C'})
              </button>
            </div>
            <div className="shrink-0 rounded border border-slate-200 bg-white p-2 shadow-sm text-xs">
              <div className="flex items-center justify-between mb-1">
                <button type="button" onClick={() => setCalendarMonth((m) => m.month === 1 ? { year: m.year - 1, month: 12 } : { year: m.year, month: m.month - 1 })} className="p-0.5 rounded hover:bg-slate-100 text-slate-500 text-[10px]">◀</button>
                <span className="font-medium text-slate-700 text-[11px]">{calendarMonth.year}/{calendarMonth.month}</span>
                <button type="button" onClick={() => setCalendarMonth((m) => m.month === 12 ? { year: m.year + 1, month: 1 } : { year: m.year, month: m.month + 1 })} className="p-0.5 rounded hover:bg-slate-100 text-slate-500 text-[10px]">▶</button>
              </div>
              <div className="grid grid-cols-7 gap-px text-center">
                {(language === 'ko' ? ['일','월','화','수','목','금','토'] : ['S','M','T','W','T','F','S']).map((d) => (
                  <div key={d} className="py-0.5 font-medium text-slate-400 text-[9px]">{d}</div>
                ))}
                {calendarDays.map((day, i) => {
                  const dateStr = day != null ? `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
                  const isSelected = dateStr === selectedDate;
                  const isToday = day != null && new Date().getFullYear() === calendarMonth.year && new Date().getMonth() + 1 === calendarMonth.month && new Date().getDate() === day;
                  return (
                    <button key={i} type="button" disabled={day == null} onClick={() => day != null && setSelectedDate(dateStr)}
                      className={`min-w-[18px] py-0.5 rounded text-[10px] transition-colors leading-tight ${day == null ? 'invisible' : isSelected ? 'bg-blue-600 text-white font-medium' : isToday ? 'border border-blue-400 text-blue-600 hover:bg-blue-50' : 'hover:bg-slate-100 text-slate-600'}`}>
                      {day ?? ''}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-6 flex-col lg:flex-row">
            <div className="flex-1 min-w-0" onClick={(e) => { if (svgRef.current && !svgRef.current.contains(e.target as Node)) setPinnedIndex(null); }}>
              {values.length > 0 ? (
                <>
                  <div className="h-96 w-full relative bg-white">
                    <svg ref={svgRef} className="w-full h-full" viewBox={`0 0 ${CHART_VIEW.width} ${CHART_VIEW.height}`} preserveAspectRatio="xMidYMid meet" onMouseMove={handleChartMouseMove} onMouseLeave={handleChartMouseLeave} onClick={handleChartClick} style={{ cursor: 'crosshair' }}>
                      <defs />
                      {yTicks.map((tickVal, i) => {
                        const y = valueToY(tickVal);
                        return <line key={`yg-${i}`} x1={CHART_PAD.left} y1={y} x2={CHART_PAD.left + chartW} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />;
                      })}
                      {xTickIndices.map((idx) => {
                        const x = indexToX(idx);
                        return <line key={`xg-${idx}`} x1={x} y1={CHART_PAD.top} x2={x} y2={CHART_PAD.top + chartH} stroke="#e5e7eb" strokeWidth="0.5" />;
                      })}
                      {yTicks.map((tickVal, i) => {
                        const y = valueToY(tickVal);
                        return <text key={`yt-l-${i}`} x={CHART_PAD.left - 6} y={y + 3} fontSize="9" fill="#6b7280" textAnchor="end">{tickVal.toFixed(1)}{activeCol?.unit ?? ''}</text>;
                      })}
                      {yTicks.map((tickVal, i) => {
                        const y = valueToY(tickVal);
                        return <text key={`yt-r-${i}`} x={CHART_PAD.left + chartW + 6} y={y + 3} fontSize="9" fill="#6b7280" textAnchor="start">{tickVal.toFixed(1)}{activeCol?.unit ?? ''}</text>;
                      })}
                      {xTickIndices.map((idx) => (
                        <text key={`xt-${idx}`} x={indexToX(idx)} y={CHART_PAD.top + chartH + 20} fontSize="10" fill="#6b7280" textAnchor="middle">{times[idx] ? formatTimeOnly(times[idx]) : '-'}</text>
                      ))}
                      <rect x={CHART_PAD.left} y={CHART_PAD.top} width={chartW} height={chartH} fill="transparent" pointerEvents="all" onClick={handleChartClick} />
                      {(() => {
                        const pts = values.map((v, i) => ({ x: indexToX(i), y: valueToY(v) }));
                        return <path key={selectedMetric} d={smoothPathD(pts)} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray="100" style={{ animation: 'chart-line-draw 1.3s ease-out forwards' }} />;
                      })()}
                      {lowerBoundIQR != null && (() => {
                        const y1 = Math.max(CHART_PAD.top, Math.min(CHART_PAD.top + chartH, valueToY(lowerBoundIQR)));
                        return <line x1={CHART_PAD.left} y1={y1} x2={CHART_PAD.left + chartW} y2={y1} stroke="#059669" strokeWidth="1" strokeDasharray="6,4" strokeLinecap="round" />;
                      })()}
                      {upperBoundIQR != null && (() => {
                        const y2 = Math.max(CHART_PAD.top, Math.min(CHART_PAD.top + chartH, valueToY(upperBoundIQR)));
                        return <line x1={CHART_PAD.left} y1={y2} x2={CHART_PAD.left + chartW} y2={y2} stroke="#dc2626" strokeWidth="1" strokeDasharray="6,4" strokeLinecap="round" />;
                      })()}
                      {Array.from(redDotIndices).map((i) => {
                        const rawY = valueToY(getRedDotValue(i));
                        const cy = Math.max(CHART_PAD.top, Math.min(CHART_PAD.top + chartH, rawY));
                        return <circle key={`reddot-${i}`} cx={indexToX(i)} cy={cy} r="4" fill="#dc2626" stroke="#fff" strokeWidth="1" pointerEvents="none" />;
                      })}
                      {displayPoint && (
                        <g>
                          <line x1={displayPoint.mouseX} y1={CHART_PAD.top} x2={displayPoint.mouseX} y2={CHART_PAD.top + chartH} stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="2,2" />
                          <circle cx={displayPoint.x} cy={displayPoint.y} r="4" fill={redDotIndices.has(displayPoint.index) ? '#dc2626' : '#3b82f6'} fillOpacity="0.3" stroke={redDotIndices.has(displayPoint.index) ? '#dc2626' : '#3b82f6'} strokeWidth="2" />
                        </g>
                      )}
                    </svg>
                  </div>
                  <div className="min-h-[2rem] mt-2 flex items-center">
                    {displayPoint ? (
                      <p className="text-sm text-slate-600 truncate max-w-full">
                        <span className="font-medium">{formatTimeOnly(displayPoint.time)}</span> · {activeCol?.nameKorean ?? ''}: {Number(values[displayPoint.index]).toFixed(2)}{activeCol?.unit ?? ''}
                        {redDotIndices.has(displayPoint.index) && <><span className="text-red-600"> {language === 'ko' ? '이상치' : 'Outlier'}: {Number(getRedDotValue(displayPoint.index)).toFixed(2)}{activeCol?.unit ?? ''}</span></>}
                        {pinnedIndex !== null && <span className="ml-2 text-xs text-slate-400">(← → {language === 'ko' ? '이동' : 'move'})</span>}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-6 mt-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-2"><span className="w-8 h-0.5 bg-blue-600" />{hasPreprocessing ? (language === 'ko' ? '전처리(preprocessing)' : 'Preprocessing') : (activeCol?.nameKorean ?? (language === 'ko' ? '시뮬레이션' : 'Simulation'))}</span>
                    <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500" />{language === 'ko' ? '이상치(sim≠prep)' : 'Outlier (sim≠prep)'}</span>
                    {lowerBoundIQR != null && <span className="inline-flex items-center gap-2"><span className="w-8 border-t border-emerald-500 border-dashed" />{language === 'ko' ? '하한선' : 'Lower'}: {lowerBoundIQR.toFixed(2)}{activeCol?.unit ?? ''}</span>}
                    {upperBoundIQR != null && <span className="inline-flex items-center gap-2"><span className="w-8 border-t border-red-500 border-dashed" />{language === 'ko' ? '상한선' : 'Upper'}: {upperBoundIQR.toFixed(2)}{activeCol?.unit ?? ''}</span>}
                  </div>
                  <p className="text-xs text-slate-500 text-center mt-1">{selectedDate} · {language === 'ko' ? '마우스를 올려 값을 확인하세요' : 'Hover to see values'}</p>
                </>
              ) : (
                <div className="py-12 text-center text-slate-500">
                  {language === 'ko' ? '표시할 데이터가 없습니다. 공정 DB에 해당 센서 데이터가 있는지 확인해 주세요.' : 'No data to display. Check if the process DB has the sensor data.'}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

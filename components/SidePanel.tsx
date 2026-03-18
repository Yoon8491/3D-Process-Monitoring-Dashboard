'use client';

import { useState, useEffect, useRef } from 'react';
import { type MachineDetail } from '@/components/Process3D';
import { useSensorData } from '@/contexts/SensorContext';
import { getEquipmentConfig } from '@/lib/influxdb-sensors';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { formatTimeSeoulWithSeconds } from '@/lib/date-format';

const PANEL_WIDTH = 320;
const SENSOR_HISTORY_MAX = 60;
const PROCESS_LABELS = [
  '01 원재료 투입',
  '02 혼합',
  '03 충전',
  '04 소성',
  '05 조분쇄',
  '06 미분쇄',
  '07 체거름',
  '08 전자석 탈철',
  '09 포장',
];

export type SensorTrend = { times: string[]; values: number[] };

type SidePanelProps = {
  open: boolean;
  onToggle: () => void;
  /** 3D 설비 클릭으로 전달된 equipmentId. 이 값만으로 매핑된 센서 표시(하단 차트 선택과 무관) */
  selectedEquipmentId?: string | null;
  machineData?: MachineDetail[];
};

/**
 * 설비 중심 우측 패널: selectedEquipmentId 기준 EQUIPMENT_TO_SENSOR_MAPPING 전체 센서만 표시.
 * 하단 모니터링 탭 센서 선택과 무관하게, 오직 3D 설비 클릭 + SensorContext만 구독.
 */
export default function SidePanel({
  open,
  onToggle,
  selectedEquipmentId = null,
  machineData: propMachineData,
}: SidePanelProps) {
  const ctx = useSensorData();
  const machineData = propMachineData ?? ctx.machineData;
  const sensorReadings = ctx.sensorReadings;
  const lastUpdated = ctx.lastUpdated;
  const [sensorHistory, setSensorHistory] = useState<Record<string, { time: string; value: number }[]>>({});
  const prevKeyRef = useRef<string>('');

  const config = selectedEquipmentId ? getEquipmentConfig(selectedEquipmentId) : null;
  const sensors = config?.sensors ?? [];

  const getReading = (sensorId: string) =>
    sensorReadings[sensorId] ??
    sensorReadings[sensorId.replace(/-/g, '_')] ??
    sensorReadings[sensorId.replace(/_/g, '-')] ??
    sensorReadings[sensorId.toLowerCase()];

  const statusLabel = (status: string) => {
    if (status === 'error' || status === '경고') return '위험';
    if (status === 'warning' || status === '주의') return '주의';
    return '정상';
  };
  const statusColor = (status: string) => {
    if (status === 'error' || status === '경고') return 'bg-red-500 text-white';
    if (status === 'warning' || status === '주의') return 'bg-amber-500 text-white';
    return 'bg-emerald-500 text-white';
  };

  useEffect(() => {
    if (sensors.length === 0) return;
    const key = sensors.map((s) => `${s.id}:${getReading(s.id)?.value ?? ''}`).join('|');
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;
    setSensorHistory((prev) => {
      const next = { ...prev };
      for (const s of sensors) {
        const r = getReading(s.id);
        if (r?.value == null || !Number.isFinite(Number(r.value))) continue;
        const arr = next[s.id] ?? [];
        const last = arr[arr.length - 1];
        if (last?.time === r.time && last?.value === r.value) continue;
        const nextArr = [...arr, { time: r.time, value: Number(r.value) }].slice(-SENSOR_HISTORY_MAX);
        next[s.id] = nextArr;
      }
      return next;
    });
  }, [sensorReadings, lastUpdated, selectedEquipmentId]);

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 w-10 h-24 flex items-center justify-center rounded-l-lg bg-slate-200 hover:bg-slate-300 text-slate-600 border border-r-0 border-slate-200 shadow-sm"
        title={open ? '패널 닫기' : '패널 열기'}
      >
        <span className="text-lg">{open ? '›' : '‹'}</span>
      </button>
      {open && (
        <div
          className="shrink-0 flex flex-col h-full bg-white border border-slate-200 overflow-hidden"
          style={{ width: PANEL_WIDTH }}
        >
          <div className="shrink-0 px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">통합 사이드 정보</h3>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* 종합 현황 */}
            <section className="p-3 border-b border-slate-100">
              <h4 className="text-xs font-semibold text-slate-600 mb-2">종합 현황</h4>
              <ul className="space-y-1.5">
                {PROCESS_LABELS.map((label, i) => {
                  const m = machineData[i];
                  const status = (m?.status as string) ?? 'normal';
                  return (
                    <li
                      key={label}
                      className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-slate-50"
                    >
                      <span className="text-sm text-slate-800 truncate">{label}</span>
                      <span
                        className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded ${statusColor(status)}`}
                      >
                        {statusLabel(status)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* 설비 클릭 시: Raw Data (InfluxDB) + 실시간 그래프 — 해당 설비 매핑 센서만 */}
            {selectedEquipmentId && config && (
              <>
                <section className="p-3 border-b border-slate-100">
                  <h4 className="text-xs font-semibold text-slate-600 mb-1">선택 설비</h4>
                  <p className="text-sm font-medium text-slate-900">{config.name}</p>
                  {lastUpdated && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      마지막 수신: {formatTimeSeoulWithSeconds(lastUpdated)}
                    </p>
                  )}
                </section>
                <section className="p-3 border-b border-slate-100">
                  <h4 className="text-xs font-semibold text-slate-600 mb-2">Raw Data (실시간)</h4>
                  {sensors.length === 0 ? (
                    <p className="text-sm text-slate-500">바인딩된 센서가 없습니다.</p>
                  ) : (
                    <ul className="space-y-2">
                      {sensors.map((s) => {
                        const reading = getReading(s.id);
                        const rawVal = reading?.value;
                        const numVal = rawVal !== null && rawVal !== undefined ? Number(rawVal) : NaN;
                        const isValid = !Number.isNaN(numVal) && Number.isFinite(numVal);
                        const timeKst = reading?.time ? formatTimeSeoulWithSeconds(reading.time) : null;
                        return (
                          <li key={s.id} className="rounded border border-slate-100 bg-slate-50/80 p-2 text-xs">
                            <div className="font-mono text-slate-700">{s.id}</div>
                            <div className="text-slate-500">{s.label}</div>
                            <div className="font-medium text-slate-900 mt-0.5">
                              {isValid ? `${Number(numVal).toFixed(1)} ${s.unit ?? ''}`.trim() : '—'}
                            </div>
                            {timeKst && <div className="text-[10px] text-slate-400 mt-0.5">{timeKst}</div>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
                <section className="p-3">
                  <h4 className="text-xs font-semibold text-slate-600 mb-2">실시간 그래프</h4>
                  <div className="space-y-4">
                    {sensors.map((s) => {
                      const history = sensorHistory[s.id] ?? [];
                      const chartData =
                        history.length >= 1
                          ? history.map((h) => ({
                              time: h.time,
                              label: formatTimeSeoulWithSeconds(h.time),
                              value: h.value,
                            }))
                          : [];
                      const reading = getReading(s.id);
                      const rawVal = reading?.value;
                      const numVal = rawVal !== null && rawVal !== undefined ? Number(rawVal) : NaN;
                      const hasValue = !Number.isNaN(numVal) && Number.isFinite(numVal);
                      return (
                        <div key={s.id} className="rounded border border-slate-100 bg-slate-50/50 p-2">
                          <p className="text-[10px] font-medium text-slate-700 mb-1">
                            {s.label} ({s.id})
                          </p>
                          {chartData.length >= 2 ? (
                            <ResponsiveContainer width="100%" height={56}>
                              <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                                <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" />
                                <XAxis dataKey="label" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
                                <YAxis width={28} tick={{ fontSize: 8 }} />
                                <Tooltip
                                  contentStyle={{ fontSize: 10 }}
                                  labelFormatter={(_, payload) =>
                                    payload?.[0]?.payload?.time
                                      ? formatTimeSeoulWithSeconds(payload[0].payload.time)
                                      : ''
                                  }
                                />
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  stroke={s.id.startsWith('HUMID') ? '#0d9488' : '#3b82f6'}
                                  strokeWidth={1.5}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <p className="text-[10px] text-slate-500 py-2">
                              {hasValue
                                ? `현재: ${Number(numVal).toFixed(1)} ${s.unit ?? ''}`.trim()
                                : '—'}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            )}

            {!selectedEquipmentId && (
              <section className="p-3">
                <p className="text-xs text-slate-500">
                  3D에서 설비를 클릭하면 해당 설비의 센서 데이터가 표시됩니다.
                </p>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export const SIDE_PANEL_WIDTH = PANEL_WIDTH;

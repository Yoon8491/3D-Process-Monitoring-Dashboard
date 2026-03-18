'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { dashboardApiUrl, authHeader } from '@/lib/api-client';
import {
  MACHINE_IDS,
  EQUIPMENT_TO_SENSOR_MAPPING,
  getEquipmentConfig,
} from '@/lib/influxdb-sensors';

/** 센서 최신값 (API 응답 형식) */
export type SensorReading = { value: number; time: string };
export type SensorReadings = Record<string, SensorReading>;

/** 공정별 MachineDetail (Process3D용) */
export type MachineDetail = {
  id: string;
  name: string;
  temperature: number;
  vibration?: number;
  rpm: number;
  power?: number;
  status: string;
  sensorTagData?: { values: { label: string; value: number; unit?: string }[]; time: string };
};

/** EQUIPMENT_TO_SENSOR_MAPPING + sensorReadings 기준으로 machineData 생성 (단일 매핑 체계) */
function buildMachineDataFromSensors(
  sensorReadings: SensorReadings
): { machineData: MachineDetail[]; lastUpdated: string | null } {
  let lastUpdated: string | null = null;
  const machineData: MachineDetail[] = MACHINE_IDS.map((equipmentId) => {
    const config = getEquipmentConfig(equipmentId);
    const sensorIds = EQUIPMENT_TO_SENSOR_MAPPING[equipmentId] ?? [];
    const sensors = config?.sensors ?? [];
    let status: 'normal' | 'warning' | 'error' = 'normal';
    let temperature = 0;
    let vibration = 0;
    let rpm = 0;
    let power = 0;
    let processTime: string | null = null;
    for (const s of sensors) {
      const r = sensorReadings[s.id];
      if (r != null && Number.isFinite(r.value)) {
        if (r.value > s.maxValue) status = 'error';
        if (r.time) {
          if (!lastUpdated || r.time > lastUpdated) lastUpdated = r.time;
          if (!processTime || r.time > processTime) processTime = r.time;
        }
        if (s.id.startsWith('TEMP') || s.id.startsWith('HUMID')) temperature = r.value;
        else if (s.id.startsWith('VIB')) vibration = r.value;
        else if (s.id.startsWith('PRESS') || s.id.startsWith('FLOW')) power = r.value;
      }
    }
    const sensorTagData =
      sensors.length > 0
        ? {
            values: sensors.map((s) => ({
              label: s.label,
              value: sensorReadings[s.id]?.value ?? 0,
              unit: s.unit,
            })),
            time: processTime ?? lastUpdated ?? '',
          }
        : undefined;
    return {
      id: equipmentId,
      name: config?.name ?? equipmentId,
      temperature,
      vibration,
      rpm,
      power,
      status,
      sensorTagData,
    };
  });
  return { machineData, lastUpdated };
}

type SensorContextType = {
  sensorReadings: SensorReadings;
  /** sensorReadings와 동일 참조 — 하단 차트와 동일 키(TEMP-001 등)로 조회용 */
  sensors: SensorReadings;
  lastUpdated: string | null;
  machineData: MachineDetail[];
  refresh: () => Promise<void>;
  dataSource: 'influxdb' | 'grafana' | 'none';
};

const defaultContext: SensorContextType = {
  sensorReadings: {},
  sensors: {},
  lastUpdated: null,
  machineData: MACHINE_IDS.map((id) => ({
    id,
    name: getEquipmentConfig(id)?.name ?? id,
    temperature: 0,
    vibration: 0,
    rpm: 0,
    power: 0,
    status: 'normal',
  })),
  refresh: async () => {},
  dataSource: 'none',
};

const SensorContext = createContext<SensorContextType>(defaultContext);

const SENSOR_POLL_MS = 1000;

export function SensorProvider({ children }: { children: React.ReactNode }) {
  const [sensorReadings, setSensorReadings] = useState<SensorReadings>({});
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [machineData, setMachineData] = useState<MachineDetail[]>(defaultContext.machineData);
  const [dataSource, setDataSource] = useState<'influxdb' | 'grafana' | 'none'>('none');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(dashboardApiUrl('/api/dashboard/sensors'), {
        headers: authHeader(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (data?.success && data.sensors != null) {
        const raw = data.sensors as Record<string, { value: number | string; time: string }>;
        const normalized: Record<string, { value: number; time: string }> = {};
        Object.entries(raw).forEach(([id, r]) => {
          if (r == null) return;
          const num = typeof r.value === 'number' ? r.value : parseFloat(String(r.value));
          if (!Number.isNaN(num)) {
            normalized[id] = { value: num, time: r.time ?? new Date().toISOString() };
          }
        });
        setSensorReadings((prev) => ({ ...prev, ...normalized }));
        setLastUpdated(data.lastUpdated ?? null);
        setDataSource(data.source ?? 'none');
        if (typeof window !== 'undefined' && Object.keys(normalized).length > 0) {
          Object.entries(normalized).forEach(([sensorId, r]) => {
            if (r?.value != null && Number.isFinite(r.value)) {
              const eq = MACHINE_IDS.find(
                (equipmentId) =>
                  (EQUIPMENT_TO_SENSOR_MAPPING[equipmentId] ?? []).includes(sensorId)
              );
              if (eq) {
                console.log(`[Mapping Success] Equipment: ${eq}, Sensor: ${sensorId}, Value: ${r.value}`);
              }
            }
          });
        }
      }
    } catch {
      /* keep previous state */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, SENSOR_POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const { machineData: next } = buildMachineDataFromSensors(sensorReadings);
    setMachineData(next);
  }, [sensorReadings]);

  const value = useMemo(
    () => ({ sensorReadings, sensors: sensorReadings, lastUpdated, machineData, refresh, dataSource }),
    [sensorReadings, lastUpdated, machineData, refresh, dataSource]
  );

  return (
    <SensorContext.Provider value={value}>
      {children}
    </SensorContext.Provider>
  );
}

export function useSensorData() {
  return useContext(SensorContext);
}

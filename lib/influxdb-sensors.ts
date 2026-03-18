/**
 * 설비·센서 매핑 단일 소스 (3D equipmentId 기준).
 * EQUIPMENT_SENSOR_CONFIG만 수정하면 PROCESS_SENSOR_CONFIG, EQUIPMENT_TO_SENSOR_MAPPING, MACHINE_IDS가 모두 일치합니다.
 */

export type SensorSpec = {
  id: string;
  label: string;
  /** 조정된 최대값. 이 값을 초과하면 해당 설비를 error 상태로 표시 */
  maxValue: number;
  unit?: string;
};

export type EquipmentSensorConfigItem = {
  equipmentId: string;
  name: string;
  sensors: SensorSpec[];
};

/**
 * 단일 소스: 3D 모델 설비 순서와 동일한 equipmentId + 공정명 + 센서 스펙.
 * 키는 반드시 3D에서 사용하는 equipmentId만 사용 (예: kiln-3, RHK-01 사용 안 함).
 */
/**
 * 01 원재료 투입: TEMP-001, HUMID-001
 * 02 혼합: MIX-VIB-001, MIX-TEMP-001 (혼합기 샤프트 진동/온도)
 * 04 소성: FLOW-001, PRESS-004, TEMP-005, TEMP-006 (유량/배기압/냉각수온도)
 * 06 미분쇄: MILL-VIB-001, MILL-TEMP-001, GAP-001 (클밀 진동/온도/롤간격)
 * 하단 '설비 상태 모니터링' InfluxDB 쿼리와 동일 ID 사용 권장.
 */
export const EQUIPMENT_SENSOR_CONFIG: EquipmentSensorConfigItem[] = [
  {
    equipmentId: 'raw-input-1',
    name: '원재료 투입',
    sensors: [
      { id: 'TEMP-001', label: '주변온도센서', maxValue: 50, unit: '°C' },
      { id: 'HUMID-001', label: '주변습도센서', maxValue: 90, unit: '%' },
    ],
  },
  {
    equipmentId: 'mixer-1',
    name: '혼합',
    sensors: [
      { id: 'MIX-VIB-001', label: '혼합기샤프트진동센서', maxValue: 10, unit: 'mm/s' },
      { id: 'MIX-TEMP-001', label: '혼합기샤프트온도센서', maxValue: 80, unit: '°C' },
    ],
  },
  {
    equipmentId: 'filler-1',
    name: '충전',
    sensors: [
      { id: 'PRESS-001', label: '탱크필터압력센서', maxValue: 1.5, unit: 'bar' },
      { id: 'PRESS-002', label: '탱크에어주입압력센서', maxValue: 1.5, unit: 'bar' },
    ],
  },
  {
    equipmentId: 'kiln-3',
    name: '소성(RHK)',
    sensors: [
      { id: 'FLOW-001', label: 'RHK유량센서', maxValue: 100, unit: '' },
      { id: 'PRESS-004', label: 'RHK배기압력센서', maxValue: 0.5, unit: 'bar' },
      { id: 'TEMP-005', label: '냉각수유입온도센서', maxValue: 60, unit: '°C' },
      { id: 'TEMP-006', label: '냉각수배출온도센서', maxValue: 60, unit: '°C' },
    ],
  },
  {
    equipmentId: 'coarse-mill-1',
    name: '조분쇄(CSM)',
    sensors: [
      { id: 'VIB-001', label: 'CSM모터진동센서', maxValue: 10, unit: 'mm/s' },
      { id: 'TEMP-002', label: 'CSM모터온도센서', maxValue: 80, unit: '°C' },
    ],
  },
  {
    equipmentId: 'fine-mill-1',
    name: '미분쇄(클밀)',
    sensors: [
      { id: 'MILL-VIB-001', label: '클밀모터진동센서', maxValue: 10, unit: 'mm/s' },
      { id: 'MILL-TEMP-001', label: '클밀모터온도센서', maxValue: 80, unit: '°C' },
      { id: 'GAP-001', label: '클밀롤간격센서', maxValue: 5, unit: 'mm' },
    ],
  },
  { equipmentId: 'sieve-1', name: '체거름', sensors: [] },
  { equipmentId: 'magnet-1', name: '전자석 탈철', sensors: [] },
  {
    equipmentId: 'packer-1',
    name: '포장',
    sensors: [{ id: 'PRESS-003', label: '충전압력센서', maxValue: 2.0, unit: 'bar' }],
  },
];

/**
 * 센서 _field/sensor_id → UI 라벨·단위 매핑 (실시간 요약 카드 등).
 * 모든 설비 센서를 한 번에 조회한 뒤 이 객체로 라벨을 붙여 표시.
 */
export const EQUIPMENT_SENSORS: Record<string, { label: string; unit?: string }> = (() => {
  const out: Record<string, { label: string; unit?: string }> = {};
  for (const eq of EQUIPMENT_SENSOR_CONFIG) {
    for (const s of eq.sensors) {
      out[s.id] = { label: s.label, unit: s.unit };
      const alt = s.id.replace(/-/g, '_');
      if (alt !== s.id) out[alt] = { label: s.label, unit: s.unit };
    }
  }
  return out;
})();

/** 3D 설비 ID 순서 (EQUIPMENT_SENSOR_CONFIG와 동일) */
export const MACHINE_IDS: string[] = EQUIPMENT_SENSOR_CONFIG.map((e) => e.equipmentId);

/** 공정 인덱스(0~8)별 설비 이름 및 바인딩 센서 — EQUIPMENT_SENSOR_CONFIG에서 파생 */
export const PROCESS_SENSOR_CONFIG: {
  processIndex: number;
  name: string;
  sensors: SensorSpec[];
}[] = EQUIPMENT_SENSOR_CONFIG.map((e, i) => ({
  processIndex: i,
  name: e.name,
  sensors: e.sensors,
}));

/** 모든 센서 ID 목록 (API 쿼리용) */
export const ALL_SENSOR_IDS: string[] = EQUIPMENT_SENSOR_CONFIG.flatMap((e) =>
  e.sensors.map((s) => s.id)
);

/**
 * 설비 ID → 센서 ID 목록 (3D equipmentId만 키로 사용, 단일 소스에서 파생)
 */
export const EQUIPMENT_TO_SENSOR_MAPPING: Record<string, string[]> = Object.fromEntries(
  EQUIPMENT_SENSOR_CONFIG.map((e) => [e.equipmentId, e.sensors.map((s) => s.id)])
);

/** 설비 ID로 센서 ID 목록 조회 */
export function getSensorsForEquipment(equipmentId: string): string[] {
  return EQUIPMENT_TO_SENSOR_MAPPING[equipmentId] ?? [];
}

/** 설비 ID로 공정명 + 센서 스펙 조회 (툴팁/패널용) */
export function getEquipmentConfig(equipmentId: string): EquipmentSensorConfigItem | null {
  return EQUIPMENT_SENSOR_CONFIG.find((e) => e.equipmentId === equipmentId) ?? null;
}

/** 센서 ID → 공정 인덱스 + 스펙 */
export function getSensorSpec(sensorId: string): { processIndex: number; spec: SensorSpec } | null {
  for (let i = 0; i < EQUIPMENT_SENSOR_CONFIG.length; i++) {
    const spec = EQUIPMENT_SENSOR_CONFIG[i].sensors.find((s) => s.id === sensorId);
    if (spec) return { processIndex: i, spec };
  }
  return null;
}

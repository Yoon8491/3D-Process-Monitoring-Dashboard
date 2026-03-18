'use client';

import { Suspense, useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Environment, ContactShadows, Bounds, useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { formatTimeSeoulWithSeconds } from '@/lib/date-format';
import { useSensorData } from '@/contexts/SensorContext';
import { getEquipmentConfig, getSensorsForEquipment } from '@/lib/influxdb-sensors';

const LABEL_Z_INDEX = 1;
const BASE_ZOOM = 16;
const ZIGZAG_AMPLITUDE = 0.22;
const MIN_LABEL_SPACING_Y = 0.12;

const PROCESSES = [
  '원재료 투입',
  '정밀 계량',
  '충진',
  '소성',
  '조분쇄',
  '미분쇄',
  '체거름',
  '전자석 탈철',
  '포장',
];

/** 공정별 표시 라벨 (순서: 1~9) */
const PROCESS_LABELS: Record<string, string> = {
  '원재료 투입': '01 원재료 투입',
  '정밀 계량': '02 정밀 계량 및 혼합',
  '충진': '03 충진',
  '소성': '04 소성',
  '조분쇄': '05 조분쇄',
  '미분쇄': '06 미분쇄',
  '체거름': '07 체거름',
  '전자석 탈철': '08 전자석 탈철',
  '포장': '09 포장',
};

/** 설비 상태 (공정 이상 감지용) */
export type MachineStatus = 'normal' | 'warning' | 'error';

/** 실시간 LOT (MariaDB 품질/상태 연동) */
export type RealtimeLot = { lotId: string; isDefective: boolean };

/** 부유형 태그용 센서 값 (InfluxDB 실시간) */
export type SensorTagValue = { label: string; value: number; unit?: string };

/** 설비 상세 정보 (클릭 시 패널 표시용) */
export type MachineDetail = {
  id: string;
  name: string;
  temperature: number;
  vibration?: number;
  rpm: number;
  power?: number;
  powerUsage?: number;
  status: '정상' | '주의' | '경고' | 'normal' | 'warning' | 'error';
  /** 부유형 실시간 태그에 표시할 센서 값 + 수신 시각 (KST 포맷용) */
  sensorTagData?: { values: SensorTagValue[]; time: string };
};

/** 가상 데이터: 설비별 상태 (백엔드 API 연동 시 이 구조로 교체) */
export const MOCK_MACHINE_DATA: { stepName: string; status: MachineStatus }[] = [
  { stepName: '원재료 투입', status: 'normal' },
  { stepName: '정밀 계량', status: 'warning' }, // 믹서 경고
  { stepName: '충진', status: 'normal' },
  { stepName: '소성', status: 'error' }, // 소성로 3번 에러
  { stepName: '조분쇄', status: 'normal' },
  { stepName: '미분쇄', status: 'normal' },
  { stepName: '체거름', status: 'normal' },
  { stepName: '전자석 탈철', status: 'normal' },
  { stepName: '포장', status: 'normal' },
];

const PIPE_RADIUS = 0.08;

// 밝은 디지털 트윈: 깨끗한 실버 메탈
const BASE_MAT = { color: '#9ca3af', metalness: 0.85, roughness: 0.25 };
const BODY_MAT = { color: '#d1d5db', metalness: 0.9, roughness: 0.2 };
const BODY_MAT_DARK = { color: '#b8bcc4', metalness: 0.88, roughness: 0.22 };
const PIPE_MAT = { color: '#9ca3af', metalness: 0.85, roughness: 0.3 };
const FRAME_MAT = { color: '#e5e7eb', metalness: 0.8, roughness: 0.3 };
const ACCENT_YELLOW = { color: '#facc15', metalness: 0.5, roughness: 0.5 };
const ACCENT_BLUE = { color: '#60a5fa', metalness: 0.4, roughness: 0.5 };
const BASE_ARGS: [number, number, number] = [1.2, 0.2, 1.2];

// ㄷ/ㄹ 레이아웃: [x, platformY, z] — 설비별 높낮이·꺾임 (02·03, 07·08·09 라벨 겹침 방지)
const LAYOUT: { x: number; y: number; z: number }[] = [
  { x: 0, y: 0, z: 0 },
  { x: 2.5, y: 0, z: 0 },
  { x: 6.5, y: 0, z: 0 },
  { x: 9.5, y: 0, z: 0 },
  { x: 12.5, y: 0.35, z: 1.2 },
  { x: 15, y: 0.35, z: 1.2 },
  { x: 17.5, y: 0.35, z: 1.2 },
  { x: 20.5, y: 0.1, z: 2.5 },
  { x: 24, y: 0, z: 3.5 },
];
// 레이아웃 기하 중심 → 씬이 화면 중앙에 오도록 월드 원점에 맞춤 (x 0~24, z 0~3.5)
const LAYOUT_CENTER_X = 12;
const LAYOUT_CENTER_Z = 1.75;
// 상세 패널이 열렸을 때: x >= 이 값이면 라벨 완전 숨김, x >= PANEL_DIM_ZONE 이면 투명도 감소
const LAYOUT_X_PANEL_ZONE = 16;
const LAYOUT_X_PANEL_DIM_ZONE = 12;

/** 회색 실선: 설비 앵커 → 라벨 연결 (통일 색상) */
function SolidConnectorLine({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const points = useMemo(() => [new THREE.Vector3(...from), new THREE.Vector3(...to)], [from, to]);
  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  return (
    <line geometry={geom}>
      <lineBasicMaterial color="#94a3b8" />
    </line>
  );
}

/** 카메라 정면을 바라보는 빌보드 부유형 태그 — useSensorData(sensors) 강제 구독, 동일 키로 값 추출 */
function BillboardSensorTag({
  position,
  equipmentId,
  isAnomaly,
  fallbackTemp,
  fallbackStatus,
}: {
  position: [number, number, number];
  equipmentId: string;
  isAnomaly: boolean;
  fallbackTemp?: number;
  fallbackStatus?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { sensors, lastUpdated } = useSensorData();
  const [, forceUpdate] = useState({});
  useEffect(() => {
    forceUpdate({});
  }, [sensors]);
  const config = getEquipmentConfig(equipmentId);
  const currentSensors = sensors ?? {};
  const displayRows = (() => {
    if (!config?.sensors?.length) return [];
    return config.sensors.map((s) => {
      const sensorData =
        currentSensors[s.id] ??
        currentSensors[s.id.replace(/-/g, '_')] ??
        currentSensors[s.id.replace(/_/g, '-')] ??
        currentSensors[s.id.toLowerCase()];
      const rawVal = sensorData?.value;
      return { label: s.label, value: rawVal, unit: s.unit };
    });
  })();
  const timeKst = lastUpdated ? formatTimeSeoulWithSeconds(lastUpdated) : null;

  useEffect(() => {
    if (typeof window === 'undefined' || !equipmentId) return;
    displayRows.forEach((r) => {
      const numericValue = r.value !== null && r.value !== undefined ? Number(r.value) : NaN;
      if (!Number.isNaN(numericValue) && Number.isFinite(numericValue)) {
        console.log(`[Mapping Success] Equipment: ${equipmentId}, Sensor: ${r.label}, Value: ${numericValue}`);
      }
    });
  }, [equipmentId, displayRows, sensors]);

  useFrame(() => {
    if (groupRef.current && camera) {
      groupRef.current.lookAt(camera.position);
    }
  });

  const validRows = displayRows.filter((r) => {
    const n = r.value !== null && r.value !== undefined ? Number(r.value) : NaN;
    return !Number.isNaN(n) && Number.isFinite(n);
  });

  if (validRows.length === 0) return <group ref={groupRef} position={position} />;

  return (
    <group ref={groupRef} position={position}>
      <Html center style={{ zIndex: LABEL_Z_INDEX, pointerEvents: 'none' }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: isAnomaly ? '#fff' : '#374151',
            background: isAnomaly ? '#dc2626' : 'rgba(255,255,255,0.95)',
            padding: '6px 10px',
            borderRadius: 6,
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            border: isAnomaly ? 'none' : '1px solid rgba(0,0,0,0.08)',
            minWidth: 80,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {validRows.map((r) => {
            const numericValue = Number(r.value);
            return (
              <div key={r.label} style={{ lineHeight: 1.4 }}>
                {r.label}: {`${numericValue.toFixed(1)} ${r.unit ?? ''}`.trim()}
              </div>
            );
          })}
          {timeKst && (
            <div style={{ marginTop: 4, fontSize: 9, opacity: 0.9 }}>
              {timeKst}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

/** 2층 철골 플랫폼 (탱크 받침대) - 바닥~탱크 밑 */
function RawMaterialPlatform() {
  const DARK_STEEL = { color: '#4a4a4a', metalness: 0.75, roughness: 0.35 };
  const platformTopY = 2.5;
  const platformH = 2.5;
  const legW = 0.12;
  const topW = 2.0;
  const topD = 1.2;

  return (
    <group>
      {/* 4개 기둥 (모서리) */}
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh
          key={i}
          position={[(sx * topW) / 2, platformH / 2, (sz * topD) / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[legW, platformH, legW]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
      ))}
      {/* 상판 (탱크 받침 테이블) */}
      <mesh position={[0, platformTopY, 0]} castShadow receiveShadow>
        <boxGeometry args={[topW + 0.2, 0.12, topD + 0.2]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      {/* 수평 보강재 (중간) */}
      <mesh position={[0, platformH * 0.5, -topD / 2 - 0.05]} castShadow>
        <boxGeometry args={[topW + 0.1, 0.06, 0.08]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      <mesh position={[0, platformH * 0.5, topD / 2 + 0.05]} castShadow>
        <boxGeometry args={[topW + 0.1, 0.06, 0.08]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
    </group>
  );
}

/** 원재료 투입: 2층 탱크(Silo) + 철골 플랫폼 + 믹서 연결 배관 */
function RawMaterialInputModel() {
  const tankX1 = -0.5;
  const tankX2 = 0.5;
  const baseH = 0.25;
  const transH = 0.4;
  const funnelH = 0.15;
  const GREY = { color: '#6b7280', metalness: 0.8, roughness: 0.3 };
  const TRANS = { color: '#c8d4e0', metalness: 0.05, roughness: 0.05, transparent: true, opacity: 0.5 };
  const PIPE_GREY = { color: '#6b7280', metalness: 0.8, roughness: 0.3 };

  const platformTopY = 2.5;
  const hopperTopY = 0.35;
  const hopperBottomY = 0.05;
  const pipeH = platformTopY - hopperTopY;
  const pipeR = 0.08;

  return (
    <group>
      {/* 1. 2층 철골 구조물 (바닥 y=0 ~ 탱크 밑 y=2.5) */}
      <RawMaterialPlatform />

      {/* 2. 탱크(Silo) - 플랫폼 위 y=2.5에 배치 (믹서 위쪽/뒤쪽) */}
      <group position={[0, platformTopY + 0.06, 0]}>
        {[
          { x: tankX1, contentColor: '#374151', contentEmissive: '#1f2937' },
          { x: tankX2, contentColor: '#e5e7eb', contentEmissive: '#d1d5db' },
        ].map((t, i) => (
          <group key={i}>
            {/* 하단 불투명 베이스 */}
            <mesh position={[t.x, baseH / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.32, 0.35, baseH, 24]} />
              <meshStandardMaterial {...GREY} />
            </mesh>
            {/* 상단 투명 실린더 (내용물 보임) */}
            <mesh position={[t.x, baseH + transH / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.3, 0.32, transH, 24]} />
              <meshStandardMaterial {...TRANS} />
            </mesh>
            {/* 내부 입자 */}
            <mesh position={[t.x, baseH + transH * 0.35, 0]}>
              <cylinderGeometry args={[0.26, 0.28, transH * 0.5, 20]} />
              <meshStandardMaterial
                color={t.contentColor}
                emissive={t.contentEmissive}
                emissiveIntensity={0.05}
                metalness={0.1}
                roughness={0.9}
              />
            </mesh>
            {/* 상단 깔때기형 연결부 */}
            <mesh position={[t.x, baseH + transH + funnelH / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.25, 0.3, funnelH, 24]} />
              <meshStandardMaterial {...GREY} />
            </mesh>
          </group>
        ))}

        {/* 노란색 T자 갠트리 빔 */}
        <mesh position={[0, baseH + transH + funnelH + 0.25, 0.35]} castShadow>
          <boxGeometry args={[1.4, 0.06, 0.08]} />
          <meshStandardMaterial {...ACCENT_YELLOW} />
        </mesh>
        <mesh position={[0, baseH + transH + funnelH + 0.25, -0.35]} castShadow>
          <boxGeometry args={[1.4, 0.06, 0.08]} />
          <meshStandardMaterial {...ACCENT_YELLOW} />
        </mesh>
        <mesh position={[-0.35, baseH + transH + funnelH + 0.3, 0]} castShadow>
          <boxGeometry args={[0.06, 0.06, 0.75]} />
          <meshStandardMaterial {...ACCENT_YELLOW} />
        </mesh>
        <mesh position={[0.35, baseH + transH + funnelH + 0.3, 0]} castShadow>
          <boxGeometry args={[0.06, 0.06, 0.75]} />
          <meshStandardMaterial {...ACCENT_YELLOW} />
        </mesh>

        {/* 상부 호퍼→탱크 투입 파이프 */}
        <mesh position={[tankX1, baseH + transH + funnelH / 2 + 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.12, 0.2, 16]} />
          <meshStandardMaterial {...GREY} />
        </mesh>
        <mesh position={[tankX2, baseH + transH + funnelH / 2 + 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.12, 0.2, 16]} />
          <meshStandardMaterial {...GREY} />
        </mesh>
      </group>

      {/* 3. 탱크 바닥 → 수신 호퍼 연결 수직 배관 (원료 투입) */}
      {[tankX1, tankX2].map((x, i) => (
        <group key={i}>
          <mesh
            position={[x, (platformTopY + hopperTopY) / 2, 0]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[pipeR, pipeR, pipeH, 16]} />
            <meshStandardMaterial {...PIPE_GREY} />
          </mesh>
          {/* 수신 호퍼 (파이프 하단 - 바닥에 고정) */}
          <mesh position={[x, (hopperTopY + hopperBottomY) / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[pipeR + 0.04, 0.06, hopperTopY - hopperBottomY, 16]} />
            <meshStandardMaterial {...PIPE_GREY} />
          </mesh>
          {/* 호퍼 받침대 (바닥 접촉) */}
          <mesh position={[x, 0.03, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.12, 0.14, 0.06, 16]} />
            <meshStandardMaterial {...PIPE_GREY} />
          </mesh>
          {/* 호퍼→믹서 방향 수평 배관 (바닥 근처, z 오프셋으로 겹침 방지) */}
          <mesh
            position={[x + 0.6, 0.08, i === 0 ? -0.08 : 0.08]}
            rotation={[0, 0, -Math.PI / 2]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.06, 0.06, 1.2, 12]} />
            <meshStandardMaterial {...PIPE_GREY} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** 철제 프레임 받침대 (설비를 올려놓는 구조) */
function SupportFrame({ width, depth, height }: { width: number; depth: number; height: number }) {
  const legW = 0.08;
  const h = Math.max(0.15, height);
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.1, h, depth + 0.1]} />
        <meshStandardMaterial {...FRAME_MAT} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}-${sz}`}
            position={[(sx * width) / 2, h / 2, (sz * depth) / 2]}
            castShadow
          >
            <boxGeometry args={[legW, h + 0.1, legW]} />
            <meshStandardMaterial {...BASE_MAT} />
          </mesh>
        ))
      )}
    </group>
  );
}

/** 공정별 3D 설비 - 밝은 실버, 철골 프레임 위 배치 */
function ProcessMachine({
  stepName,
  isActive = false,
  index,
  status = 'normal',
  machineDetail,
  sensorReadings = {},
  lastUpdated = null,
  onClick,
  onPointerOver,
  onPointerOut,
  isSelected = false,
  hasDefective = false,
  detailPanelOpen = false,
  showSensorTag = false,
}: {
  stepName: string;
  isActive?: boolean;
  index: number;
  status?: MachineStatus;
  machineDetail?: MachineDetail;
  sensorReadings?: Record<string, { value: number; time: string }>;
  lastUpdated?: string | null;
  onClick?: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
  isSelected?: boolean;
  /** 해당 공정에 불량 LOT가 있을 때 true (MariaDB 품질 데이터 기반) */
  hasDefective?: boolean;
  /** 우측 상세 정보창이 열려 있으면 true — 해당 구역 라벨·연결선 자동 숨김 */
  detailPanelOpen?: boolean;
  /** 센서 태그(0°C·가동 등) 표시 여부 — 클릭 시에만 true */
  showSensorTag?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const isInteractive = Boolean(onClick);
  useCursor(hovered && isInteractive, 'pointer', 'auto');
  const pos = LAYOUT[index];
  const isCalcination = stepName === '소성';
  const isRawInput = stepName === '원재료 투입';
  const isFilling = stepName === '충진';
  const frameW = isCalcination ? 4 : isRawInput ? 2.6 : isFilling ? 1.7 : 1.4;
  const frameD = isCalcination ? 2.8 : isRawInput ? 1.7 : isFilling ? 1.0 : 1.4;
  const frameH = pos.y;

  // 이상(불량/에러) 시 빨간 야광, 경고 시 주황, 선택 시 청록
  const isAnomaly = hasDefective || status === 'error';
  const isWarning = status === 'warning';
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat: THREE.Material & { emissive?: THREE.Color; emissiveIntensity?: number }) => {
          if (mat.emissive) {
            if (isAnomaly) {
              mat.emissive.setHex(0xdc2626);
              mat.emissiveIntensity = 0.7;
            } else if (isWarning) {
              mat.emissive.setHex(0xf59e0b);
              mat.emissiveIntensity = 0.45;
            } else if (isSelected) {
              mat.emissive.setHex(0x22d3ee);
              mat.emissiveIntensity = 0.35;
            } else {
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            }
          }
        });
      }
    });
  }, [isAnomaly, isWarning, isSelected]);

  const renderBody = () => {
    switch (stepName) {
      case '원재료 투입': {
        return <RawMaterialInputModel />;
      }
      case '정밀 계량': {
        // 횡형 믹서기 - 사진 기준: 투명 창 + 내부 입자, 상부 곡선 배관, 모터 별도 프레임, 하단 배출구
        const drumLen = 1.15;
        const drumR = 0.32;
        const drumY = 0.62;
        const motorW = 0.26;
        const motorH = 0.24;
        const motorD = 0.24;
        const motorX = -drumLen / 2 - motorW / 2 - 0.15;
        const gearW = 0.14;
        const gearH = 0.16;
        const gearD = 0.16;
        const gearX = -drumLen / 2 - gearW / 2 + 0.05;

        const skidY = 0.14;
        const skidW = 1.7;
        const skidD = 0.9;
        const DARK_FRAME = { color: '#4a4a4a', metalness: 0.75, roughness: 0.35 };
        const LIGHT_FRAME = { color: '#a8adb5', metalness: 0.7, roughness: 0.4 };
        const MOTOR_BLUE = { color: '#2563eb', metalness: 0.25, roughness: 0.55 };
        const GEAR_ORANGE = { color: '#f97316', metalness: 0.2, roughness: 0.6 };
        const TRANS_WINDOW = {
          color: '#e8ecf0',
          metalness: 0.05,
          roughness: 0.05,
          transparent: true,
          opacity: 0.65,
        };
        const GRANULE_DARK = { color: '#374151', metalness: 0.1, roughness: 0.9 };
        const GRANULE_LIGHT = { color: '#9ca3af', metalness: 0.1, roughness: 0.9 };

        const pipeR = 0.04;
        const pipeV = 0.35;
        const pipeBaseY = drumY + drumR + 0.02;

        return (
          <group>
            {/* 다크 그레이 철골 플랫폼 (믹서 받침) */}
            <mesh position={[0, skidY / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[skidW, skidY, skidD]} />
              <meshStandardMaterial {...DARK_FRAME} />
            </mesh>
            <mesh position={[-skidW / 2 + 0.08, skidY + 0.18, 0]} castShadow>
              <boxGeometry args={[0.06, 0.36, skidD - 0.12]} />
              <meshStandardMaterial {...DARK_FRAME} />
            </mesh>
            <mesh position={[skidW / 2 - 0.08, skidY + 0.18, 0]} castShadow>
              <boxGeometry args={[0.06, 0.36, skidD - 0.12]} />
              <meshStandardMaterial {...DARK_FRAME} />
            </mesh>
            {/* 하단 노란 가이드/레일 */}
            <mesh position={[0, 0.02, skidD / 2 + 0.04]} castShadow>
              <boxGeometry args={[skidW + 0.1, 0.04, 0.06]} />
              <meshStandardMaterial {...ACCENT_YELLOW} />
            </mesh>

            {/* 메인 드럼: 후면·측면 금속 (불투명) */}
            <mesh position={[0, drumY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              <cylinderGeometry args={[drumR, drumR, drumLen, 28]} />
              <meshStandardMaterial {...BODY_MAT} />
            </mesh>
            {/* 투명 창 (전면 상부) - 내부 입자 보임 */}
            <mesh
              position={[0.25, drumY, 0]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
              receiveShadow
            >
              <cylinderGeometry args={[drumR - 0.02, drumR - 0.02, drumLen * 0.45, 24, 1, false, Math.PI * 0.15, Math.PI * 0.55]} />
              <meshStandardMaterial {...TRANS_WINDOW} />
            </mesh>
            {/* 내부 혼합 입자 (어두운 알갱이 + 연한 입자) */}
            <mesh position={[0.2, drumY, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[drumR * 0.7, drumR * 0.7, drumLen * 0.35, 20]} />
              <meshStandardMaterial {...GRANULE_DARK} />
            </mesh>
            <mesh position={[0.25, drumY, 0.05]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[drumR * 0.4, drumR * 0.4, drumLen * 0.2, 16]} />
              <meshStandardMaterial {...GRANULE_LIGHT} />
            </mesh>

            {/* 구동부: 연한 회색 별도 프레임 위 파란 모터 + 주황 기어박스 */}
            <mesh position={[motorX - 0.12, skidY + 0.08, 0]} castShadow receiveShadow>
              <boxGeometry args={[motorW + 0.2, 0.1, motorD + 0.15]} />
              <meshStandardMaterial {...LIGHT_FRAME} />
            </mesh>
            <mesh position={[motorX, drumY, 0]} castShadow receiveShadow>
              <boxGeometry args={[motorW, motorH, motorD]} />
              <meshStandardMaterial {...MOTOR_BLUE} />
            </mesh>
            <mesh position={[gearX, drumY, 0]} castShadow receiveShadow>
              <boxGeometry args={[gearW, gearH, gearD]} />
              <meshStandardMaterial {...GEAR_ORANGE} />
            </mesh>
            <mesh position={[-drumLen / 2 - 0.02, drumY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 0.12, 16]} />
              <meshStandardMaterial {...BASE_MAT} />
            </mesh>

            {/* 상부 배관 2개: 위에서 내려오는 곡선형 수직 파이프 */}
            {[-0.2, 0.2].map((x, idx) => (
              <group key={`pipe-${idx}`}>
                <mesh position={[x, pipeBaseY + pipeV / 2, 0.15]} castShadow receiveShadow>
                  <cylinderGeometry args={[pipeR, pipeR, pipeV, 12]} />
                  <meshStandardMaterial {...PIPE_MAT} />
                </mesh>
                <mesh position={[x, pipeBaseY + pipeV, 0.15]} castShadow receiveShadow>
                  <cylinderGeometry args={[pipeR + 0.01, pipeR, 0.08, 12]} />
                  <meshStandardMaterial {...PIPE_MAT} />
                </mesh>
              </group>
            ))}

            {/* 하단 배출구 2개 (드럼 아래 원통) */}
            {[-0.25, 0.25].map((x, idx) => (
              <mesh key={idx} position={[x, skidY + 0.35, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.06, 0.07, 0.2, 12]} />
                <meshStandardMaterial {...DARK_FRAME} />
              </mesh>
            ))}
          </group>
        );
      }
      case '충진': {
        // 2선 롤러 컨베이어 + 플랫 LOT 트레이 + 양쪽 호퍼 (사진 기준)
        const DARK_FRAME = { color: '#4a4a4a', metalness: 0.75, roughness: 0.35 };
        const LOT_TRAY = { color: '#374151', metalness: 0.5, roughness: 0.6 };
        const PIPE_MAT = { color: '#6b7280', metalness: 0.8, roughness: 0.3 };

        const beltLen = 1.1;
        const beltY = 0.18;
        const trackZ1 = -0.22;
        const trackZ2 = 0.22;
        const rollerCount = 18;
        const rollerR = 0.02;
        const rollerLen = 0.12;
        const lotW = 0.12;
        const lotD = 0.09;
        const lotH = 0.02;

        return (
          <group>
            {/* 라티스형 철골 지지대 (다크 그레이 오픈프레임) */}
            {[-0.55, -0.2, 0.15, 0.5].map((x, i) => (
              <group key={i}>
                <mesh position={[x, 0.08, trackZ1]} castShadow>
                  <boxGeometry args={[0.05, 0.16, 0.05]} />
                  <meshStandardMaterial {...DARK_FRAME} />
                </mesh>
                <mesh position={[x, 0.08, trackZ2]} castShadow>
                  <boxGeometry args={[0.05, 0.16, 0.05]} />
                  <meshStandardMaterial {...DARK_FRAME} />
                </mesh>
              </group>
            ))}
            {[-0.4, 0, 0.4].map((z, i) => (
              <mesh key={`h-${i}`} position={[0, 0.06, z]} castShadow>
                <boxGeometry args={[beltLen + 0.3, 0.04, 0.04]} />
                <meshStandardMaterial {...DARK_FRAME} />
              </mesh>
            ))}

            {/* 2선 롤러 컨베이어 (원통형 롤러 나열) */}
            {[trackZ1, trackZ2].map((tz, trackIdx) =>
              Array.from({ length: rollerCount }, (_, i) => {
                const x = -beltLen / 2 + (i / (rollerCount - 1)) * beltLen;
                return (
                  <mesh
                    key={`roll-${trackIdx}-${i}`}
                    position={[x, beltY + rollerR, tz]}
                    rotation={[0, 0, Math.PI / 2]}
                    castShadow
                    receiveShadow
                  >
                    <cylinderGeometry args={[rollerR, rollerR, rollerLen, 12]} />
                    <meshStandardMaterial {...DARK_FRAME} />
                  </mesh>
                );
              })
            )}

            {/* LOT 형태: 평평한 직사각형 트레이 (다크 그레이, 일정 간격) */}
            {[trackZ1, trackZ2].map((tz, trackIdx) =>
              [-0.42, -0.22, -0.02, 0.18, 0.38].map((x, i) => (
                <mesh
                  key={`lot-${trackIdx}-${i}`}
                  position={[x, beltY + rollerR * 2 + lotH / 2, tz]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[lotW, lotH, lotD]} />
                  <meshStandardMaterial {...LOT_TRAY} />
                </mesh>
              ))
            )}

            {/* 충진 스테이션 2개: 좌측, 각 트랙 위에 호퍼 */}
            {[
              { z: trackZ1, xOffset: -0.5 },
              { z: trackZ2, xOffset: -0.5 },
            ].map(({ z, xOffset }, idx) => (
              <group key={`hopper-${idx}`}>
                {/* 호퍼 받침 플랫폼 (오픈프레임) */}
                <mesh position={[xOffset, 0.2, z]} castShadow receiveShadow>
                  <boxGeometry args={[0.35, 0.08, 0.3]} />
                  <meshStandardMaterial {...DARK_FRAME} />
                </mesh>
                <mesh position={[xOffset - 0.12, 0.12, z]} castShadow>
                  <boxGeometry args={[0.06, 0.2, 0.06]} />
                  <meshStandardMaterial {...DARK_FRAME} />
                </mesh>
                <mesh position={[xOffset + 0.12, 0.12, z]} castShadow>
                  <boxGeometry args={[0.06, 0.2, 0.06]} />
                  <meshStandardMaterial {...DARK_FRAME} />
                </mesh>
                {/* 호퍼 (원통 상부 + 원뿔 하부, 다크 그레이) */}
                <mesh position={[xOffset, 0.5, z]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.14, 0.14, 0.25, 24]} />
                  <meshStandardMaterial {...DARK_FRAME} />
                </mesh>
                <mesh position={[xOffset, 0.34, z]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.14, 0.06, 0.2, 24]} />
                  <meshStandardMaterial {...DARK_FRAME} />
                </mesh>
                {/* 호퍼→컨베이어 수직 배관 */}
                <mesh position={[xOffset, 0.2, z]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.05, 0.05, 0.12, 12]} />
                  <meshStandardMaterial {...PIPE_MAT} />
                </mesh>
              </group>
            ))}

            {/* 호퍼 간 연결 배관: 상부 아치 + 하부 직관 */}
            <mesh position={[-0.5, 0.58, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.03, 0.03, 0.44, 12]} />
              <meshStandardMaterial {...PIPE_MAT} />
            </mesh>
            <mesh position={[-0.5, 0.38, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.44, 12]} />
              <meshStandardMaterial {...PIPE_MAT} />
            </mesh>
          </group>
        );
      }
      case '소성': {
        // Roller Hearth Kiln - 6개 세그먼트 연속 배치 (기차형 긴 터널)
        const SEG_COUNT = 6;
        const SEG_LEN = 0.62;
        const TOTAL_LEN = SEG_COUNT * SEG_LEN;
        const baseH = 0.18;
        const wallH = 0.65;
        const archH = 0.35;
        const D = 1.35;
        const KILN_DARK = { color: '#4b5563', metalness: 0.85, roughness: 0.4 };
        const KILN_SIDE = { color: '#374151', metalness: 0.88, roughness: 0.35 };
        const cavityH = 0.25;

        return (
          <group>
            {Array(SEG_COUNT)
              .fill(null)
              .map((_, segIdx) => {
                const segX = -TOTAL_LEN / 2 + SEG_LEN / 2 + segIdx * SEG_LEN;
                return (
                  <group key={segIdx} position={[segX, 0, 0]}>
                    {/* 하단 베이스 */}
                    <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
                      <boxGeometry args={[SEG_LEN + 0.01, baseH, D + 0.15]} />
                      <meshStandardMaterial {...KILN_SIDE} />
                    </mesh>
                    {/* 좌측 벽 */}
                    <mesh position={[0, baseH + wallH / 2, -D / 2 - 0.04]} castShadow receiveShadow>
                      <boxGeometry args={[SEG_LEN, wallH, 0.12]} />
                      <meshStandardMaterial {...KILN_DARK} />
                    </mesh>
                    {/* 우측 벽 */}
                    <mesh position={[0, baseH + wallH / 2, D / 2 + 0.04]} castShadow receiveShadow>
                      <boxGeometry args={[SEG_LEN, wallH, 0.12]} />
                      <meshStandardMaterial {...KILN_DARK} />
                    </mesh>
                    {/* 지붕 */}
                    <mesh position={[0, baseH + wallH + archH / 2, 0]} castShadow receiveShadow>
                      <boxGeometry args={[SEG_LEN, archH, D - 0.15]} />
                      <meshStandardMaterial {...KILN_DARK} />
                    </mesh>
                    {/* 내부 고온 가열 영역 (주황~빨강) */}
                    <mesh position={[0, baseH + cavityH / 2 + 0.08, 0]} castShadow receiveShadow>
                      <boxGeometry args={[SEG_LEN - 0.04, cavityH, D - 0.5]} />
                      <meshStandardMaterial
                        color={segIdx === 2 || segIdx === 3 ? '#dc2626' : '#f97316'}
                        emissive={segIdx === 2 || segIdx === 3 ? '#991b1b' : '#b45309'}
                        emissiveIntensity={0.55}
                        metalness={0.25}
                        roughness={0.65}
                      />
                    </mesh>
                  </group>
                );
              })}
            {/* 입구/출구 프레임 (맨 앞·뒤) */}
            <mesh position={[-TOTAL_LEN / 2 - 0.1, baseH + wallH / 2, 0]} castShadow>
              <boxGeometry args={[0.14, wallH + 0.1, D + 0.2]} />
              <meshStandardMaterial {...KILN_SIDE} />
            </mesh>
            <mesh position={[TOTAL_LEN / 2 + 0.1, baseH + wallH / 2, 0]} castShadow>
              <boxGeometry args={[0.14, wallH + 0.1, D + 0.2]} />
              <meshStandardMaterial {...KILN_SIDE} />
            </mesh>
            {/* 킬른 내부 LOT들 (일렬, 연한 황/주황) */}
            {Array.from({ length: 24 }, (_, i) => {
              const x = -TOTAL_LEN / 2 + 0.2 + (i / 23) * (TOTAL_LEN - 0.4);
              return (
                <mesh key={i} position={[x, baseH + 0.12, 0]} castShadow>
                  <boxGeometry args={[0.08, 0.06, 0.1]} />
                  <meshStandardMaterial
                    color="#fbbf24"
                    emissive="#f59e0b"
                    emissiveIntensity={0.2}
                    metalness={0.2}
                    roughness={0.7}
                  />
                </mesh>
              );
            })}
          </group>
        );
      }
      case '조분쇄': {
        // 조분쇄기: 호퍼 + 톱니 롤러 + 파란 모터 + 노란 지지대
        const GREY = { color: '#6b7280', metalness: 0.8, roughness: 0.35 };
        const DARK = { color: '#374151', metalness: 0.85, roughness: 0.4 };
        const MOTOR_BLUE = { color: '#2563eb', metalness: 0.3, roughness: 0.6 };

        return (
          <group>
            {/* 베이스: 4다리 + 상판 */}
            <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.9, 0.08, 0.7]} />
              <meshStandardMaterial {...DARK} />
            </mesh>
            {[-1, 1].map((sx) =>
              [-1, 1].map((sz) => (
                <mesh key={`leg-${sx}-${sz}`} position={[sx * 0.35, 0.1, sz * 0.28]} castShadow>
                  <boxGeometry args={[0.06, 0.2, 0.06]} />
                  <meshStandardMaterial {...DARK} />
                </mesh>
              ))
            )}

            {/* 출력 트레이 (어두운 회색) */}
            <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.6, 0.04, 0.4]} />
              <meshStandardMaterial {...DARK} />
            </mesh>

            {/* 노란색 U자 지지대 (좌우) */}
            <mesh position={[-0.38, 0.45, 0]} castShadow>
              <boxGeometry args={[0.1, 0.5, 0.5]} />
              <meshStandardMaterial {...ACCENT_YELLOW} />
            </mesh>
            <mesh position={[0.38, 0.45, 0]} castShadow>
              <boxGeometry args={[0.1, 0.5, 0.5]} />
              <meshStandardMaterial {...ACCENT_YELLOW} />
            </mesh>

            {/* 분쇄실 하우징 (진한 회색, 하단 개방) */}
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.55, 0.35, 0.45]} />
              <meshStandardMaterial {...DARK} />
            </mesh>

            {/* 내부 발광 (은은한 황백색) */}
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={[0.5, 0.28, 0.4]} />
              <meshStandardMaterial color="#fef3c7" emissive="#fde68a" emissiveIntensity={0.4} metalness={0.1} roughness={0.8} />
            </mesh>

            {/* 톱니 롤러 2개 (인접 배치, 8각형으로 톱니 느낌) */}
            <mesh position={[-0.08, 0.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.12, 0.12, 0.38, 8]} />
              <meshStandardMaterial {...GREY} />
            </mesh>
            <mesh position={[0.08, 0.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.12, 0.12, 0.38, 8]} />
              <meshStandardMaterial {...GREY} />
            </mesh>

            {/* 파란 모터 (좌) */}
            <mesh position={[-0.45, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
              <meshStandardMaterial {...MOTOR_BLUE} />
            </mesh>
            <mesh position={[-0.52, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 0.12, 12]} />
              <meshStandardMaterial {...GREY} />
            </mesh>

            {/* 파란 모터 (우) + 흰색 팬 캡 */}
            <mesh position={[0.45, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
              <meshStandardMaterial {...MOTOR_BLUE} />
            </mesh>
            <mesh position={[0.52, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 0.12, 12]} />
              <meshStandardMaterial {...GREY} />
            </mesh>
            <mesh position={[0.58, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 0.02, 16]} />
              <meshStandardMaterial color="#f0f0f0" metalness={0.2} roughness={0.7} />
            </mesh>

            {/* 상단 호퍼 (역피라미드형 - 잘린 원뿔) */}
            <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.35, 0.15, 0.3, 16]} />
              <meshStandardMaterial {...GREY} />
            </mesh>
          </group>
        );
      }
      case '미분쇄': {
        // Air Classifier Mill (ACM): 투명 원통 + 호퍼 + 곡관
        const GREY = { color: '#6b7280', metalness: 0.8, roughness: 0.35 };
        const DARK = { color: '#4b5563', metalness: 0.85, roughness: 0.35 };

        return (
          <group>
            {/* ACM 본체: 상·하단 회색 캡 + 투명 실린더 */}
            <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.35, 0.38, 0.2, 24]} />
              <meshStandardMaterial {...GREY} />
            </mesh>
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.38, 0.38, 0.7, 24]} />
              <meshStandardMaterial
                color="#e8ecf0"
                metalness={0.1}
                roughness={0.1}
                transparent
                opacity={0.35}
              />
            </mesh>
            <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.4, 0.38, 0.15, 24]} />
              <meshStandardMaterial {...GREY} />
            </mesh>

            {/* 내부: 중앙 축 */}
            <mesh position={[0, 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 0.65, 12]} />
              <meshStandardMaterial {...DARK} />
            </mesh>

            {/* 내부 링 + 조명 (흰색 원형) */}
            <mesh position={[0, 0.6, 0.25]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.01, 12]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
            </mesh>
            <mesh position={[0, 0.6, -0.25]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.01, 12]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
            </mesh>

            {/* 내부 입자 표현 (하단 짙은 입자 + 상단 연한 입자) */}
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.3, 0.32, 0.12, 16]} />
              <meshStandardMaterial color="#374151" metalness={0.2} roughness={0.8} />
            </mesh>
            {[0.45, 0.55, 0.65].map((y, i) => (
              <mesh key={i} position={[0.15 - i * 0.05, y, 0.1]} castShadow>
                <boxGeometry args={[0.05, 0.05, 0.05]} />
                <meshStandardMaterial color="#d1d5db" metalness={0.1} roughness={0.9} />
              </mesh>
            ))}

            {/* 좌측 호퍼 (다단 구조) */}
            <mesh position={[-0.55, 0.7, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.22, 0.15, 0.35, 16]} />
              <meshStandardMaterial {...GREY} />
            </mesh>
            <mesh position={[-0.55, 0.42, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.15, 0.12, 0.25, 16]} />
              <meshStandardMaterial {...GREY} />
            </mesh>

            {/* 호퍼 전면 노란 박스 2개 + 상단 흰색 발광 스트립 */}
            <mesh position={[-0.55, 0.82, 0.2]} castShadow>
              <boxGeometry args={[0.1, 0.08, 0.06]} />
              <meshStandardMaterial {...ACCENT_YELLOW} />
            </mesh>
            <mesh position={[-0.55, 0.865, 0.2]} castShadow>
              <boxGeometry args={[0.08, 0.015, 0.02]} />
              <meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={0.6} />
            </mesh>
            <mesh position={[-0.55, 0.68, 0.2]} castShadow>
              <boxGeometry args={[0.1, 0.08, 0.06]} />
              <meshStandardMaterial {...ACCENT_YELLOW} />
            </mesh>
            <mesh position={[-0.55, 0.725, 0.2]} castShadow>
              <boxGeometry args={[0.08, 0.015, 0.02]} />
              <meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={0.6} />
            </mesh>

            {/* 곡관: 호퍼 → ACM 연결 */}
            <mesh position={[-0.3, 0.25, 0.1]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 0.4, 12]} />
              <meshStandardMaterial {...GREY} />
            </mesh>
            <mesh position={[-0.15, 0.35, 0.08]} rotation={[Math.PI / 4, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.055, 0.055, 0.35, 12]} />
              <meshStandardMaterial {...GREY} />
            </mesh>
            <mesh position={[-0.05, 0.5, 0.05]} rotation={[Math.PI / 3, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 0.25, 12]} />
              <meshStandardMaterial {...GREY} />
            </mesh>
          </group>
        );
      }
      case '전자석 탈철': {
        // 고자력 전자석 탈철기: 원통형 + 내부 청색 발광 챔버 + 중앙 컬럼
        const DARK = { color: '#4b5563', metalness: 0.85, roughness: 0.35 };
        const BLUE_GLOW = { color: '#3b82f6', emissive: '#2563eb', emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.6 };

        return (
          <group>
            {/* 베이스: 4다리 + 직사각형 받침 */}
            <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.7, 0.06, 0.55]} />
              <meshStandardMaterial {...DARK} />
            </mesh>
            {[-1, 1].map((sx) =>
              [-1, 1].map((sz) => (
                <mesh key={`leg-${sx}-${sz}`} position={[sx * 0.28, 0.12, sz * 0.2]} castShadow>
                  <boxGeometry args={[0.06, 0.2, 0.06]} />
                  <meshStandardMaterial {...DARK} />
                </mesh>
              ))
            )}

            {/* 원형 플랫폼 (상단 기판) */}
            <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.4, 0.4, 0.05, 24]} />
              <meshStandardMaterial {...DARK} />
            </mesh>

            {/* 외부 케이싱 (진한 회색 원통) */}
            <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.32, 0.32, 0.6, 24]} />
              <meshStandardMaterial {...DARK} />
            </mesh>

            {/* 내부 청색 발광 챔버 (자기장 영역) */}
            <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.26, 0.26, 0.5, 24]} />
              <meshStandardMaterial {...BLUE_GLOW} />
            </mesh>

            {/* 내부 그리드/분할판 (수평 구조물) */}
            {[0.35, 0.5, 0.65].map((y, i) => (
              <mesh key={i} position={[0, y, 0]} castShadow>
                <cylinderGeometry args={[0.24, 0.24, 0.02, 16]} />
                <meshStandardMaterial color="#1e40af" metalness={0.3} roughness={0.7} />
              </mesh>
            ))}

            {/* 내부 흰색 조명 2개 */}
            <mesh position={[0.12, 0.55, 0.12]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.02, 12]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.5} />
            </mesh>
            <mesh position={[-0.12, 0.55, -0.12]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.02, 12]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.5} />
            </mesh>

            {/* 중앙 컬럼 (어두운 질감, 상단 플루트 확대) */}
            <mesh position={[0, 0.55, 0]} castShadow>
              <cylinderGeometry args={[0.1, 0.1, 0.55, 12]} />
              <meshStandardMaterial {...DARK} />
            </mesh>
            <mesh position={[0, 0.82, 0]} castShadow>
              <cylinderGeometry args={[0.14, 0.1, 0.12, 12]} />
              <meshStandardMaterial {...DARK} />
            </mesh>

            {/* 상단 U자 후크/부착점 */}
            {[-1, 0, 1].map((s, i) => (
              <mesh key={i} position={[s * 0.12, 0.95, 0.22]} castShadow>
                <boxGeometry args={[0.06, 0.08, 0.04]} />
                <meshStandardMaterial {...DARK} />
              </mesh>
            ))}
          </group>
        );
      }
      case '체거름': {
        // 2~3단 체거름: 투명 원통 쌓기 + 주름관 + 측면 실린더
        const DARK = { color: '#4b5563', metalness: 0.85, roughness: 0.35 };
        const r1 = 0.28;
        const r2 = 0.26;
        const r3 = 0.24;
        const h = 0.18;

        return (
          <group>
            {/* 하단 베이스 (원형 기판) */}
            <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.45, 0.45, 0.06, 16]} />
              <meshStandardMaterial {...DARK} />
            </mesh>

            {/* 3단 투명 체거름 실린더 (하→중→상) */}
            <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[r3, r3, h, 24]} />
              <meshStandardMaterial {...DARK} />
            </mesh>
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[r3 - 0.02, r3 - 0.02, h - 0.02, 24]} />
              <meshStandardMaterial color="#c8d4e0" metalness={0.1} roughness={0.05} transparent opacity={0.4} />
            </mesh>
            <mesh position={[0, 0.18, 0]}>
              <boxGeometry args={[0.15, 0.04, 0.15]} />
              <meshStandardMaterial color="#e5e7eb" metalness={0.1} roughness={0.9} />
            </mesh>

            <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[r2, r2, h, 24]} />
              <meshStandardMaterial {...DARK} />
            </mesh>
            <mesh position={[0, 0.45, 0]}>
              <cylinderGeometry args={[r2 - 0.02, r2 - 0.02, h - 0.02, 24]} />
              <meshStandardMaterial color="#c8d4e0" metalness={0.1} roughness={0.05} transparent opacity={0.45} />
            </mesh>
            <mesh position={[0, 0.43, 0]}>
              <boxGeometry args={[0.12, 0.035, 0.12]} />
              <meshStandardMaterial color="#e5e7eb" metalness={0.1} roughness={0.9} />
            </mesh>

            <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[r1, r1, h, 24]} />
              <meshStandardMaterial {...DARK} />
            </mesh>
            <mesh position={[0, 0.7, 0]}>
              <cylinderGeometry args={[r1 - 0.02, r1 - 0.02, h - 0.02, 24]} />
              <meshStandardMaterial color="#c8d4e0" metalness={0.1} roughness={0.05} transparent opacity={0.5} />
            </mesh>
            <mesh position={[0, 0.68, 0]}>
              <boxGeometry args={[0.18, 0.04, 0.18]} />
              <meshStandardMaterial color="#e5e7eb" metalness={0.1} roughness={0.9} />
            </mesh>

            {/* 상단 입구 (진한 넓은 원통) */}
            <mesh position={[0, 0.92, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.32, 0.28, 0.12, 24]} />
              <meshStandardMaterial {...DARK} />
            </mesh>

            {/* 우측 수직 지지대 */}
            <mesh position={[0.38, 0.5, 0]} castShadow>
              <boxGeometry args={[0.05, 0.75, 0.05]} />
              <meshStandardMaterial {...DARK} />
            </mesh>

            {/* 우측 주름관 (벨로우즈형 - 여러 원통 겹침) */}
            {Array.from({ length: 10 }, (_, i) => {
              const y = 0.22 + (i / 9) * 0.7;
              const s = 0.95 + (i % 2) * 0.1;
              return (
                <mesh key={i} position={[0.4, y, 0]} castShadow>
                  <cylinderGeometry args={[0.05 * s, 0.05 * s, 0.06, 12]} />
                  <meshStandardMaterial {...DARK} />
                </mesh>
              );
            })}

            {/* 우측 부속: 넓은 원통 + 주름관 */}
            <mesh position={[0.6, 0.15, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.12, 0.12, 16]} />
              <meshStandardMaterial {...DARK} />
            </mesh>
            {Array.from({ length: 4 }, (_, i) => (
              <mesh key={i} position={[0.6, 0.35 + i * 0.08, 0]} castShadow>
                <cylinderGeometry args={[0.04, 0.04, 0.05, 10]} />
                <meshStandardMaterial {...DARK} />
              </mesh>
            ))}

            {/* 우측 끝 짧은 원통 */}
            <mesh position={[0.75, 0.2, 0]} castShadow>
              <cylinderGeometry args={[0.1, 0.1, 0.1, 16]} />
              <meshStandardMaterial {...DARK} />
            </mesh>
          </group>
        );
      }
      case '포장': {
        // FIBC 벌크백 + 밀폐 프레임 + 파란 플랫폼 (온/습도 제어)
        const FRAME = { color: '#6b7280', metalness: 0.8, roughness: 0.4 };
        const BAG = { color: '#f8fafc', metalness: 0.1, roughness: 0.9 };

        return (
          <group>
            {/* 파란 플랫폼 (저울/컨테이너) */}
            <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.55, 0.08, 0.45]} />
              <meshStandardMaterial color="#3b82f6" metalness={0.2} roughness={0.7} />
            </mesh>

            {/* 회색 오픈프레임 구조 (밀폐 구조) */}
            {[-1, 1].map((sx) =>
              [-1, 1].map((sz) => (
                <mesh key={`p-${sx}-${sz}`} position={[sx * 0.28, 0.45, sz * 0.2]} castShadow>
                  <boxGeometry args={[0.05, 0.65, 0.05]} />
                  <meshStandardMaterial {...FRAME} />
                </mesh>
              ))
            )}
            {/* 수평 빔 */}
            <mesh position={[0, 0.72, -0.2]} castShadow>
              <boxGeometry args={[0.6, 0.04, 0.04]} />
              <meshStandardMaterial {...FRAME} />
            </mesh>
            <mesh position={[0, 0.72, 0.2]} castShadow>
              <boxGeometry args={[0.6, 0.04, 0.04]} />
              <meshStandardMaterial {...FRAME} />
            </mesh>
            <mesh position={[-0.28, 0.72, 0]} castShadow>
              <boxGeometry args={[0.04, 0.04, 0.45]} />
              <meshStandardMaterial {...FRAME} />
            </mesh>
            <mesh position={[0.28, 0.72, 0]} castShadow>
              <boxGeometry args={[0.04, 0.04, 0.45]} />
              <meshStandardMaterial {...FRAME} />
            </mesh>
            {/* 중간 수평 빔 */}
            <mesh position={[0, 0.42, -0.2]} castShadow>
              <boxGeometry args={[0.55, 0.03, 0.03]} />
              <meshStandardMaterial {...FRAME} />
            </mesh>
            <mesh position={[0, 0.42, 0.2]} castShadow>
              <boxGeometry args={[0.55, 0.03, 0.03]} />
              <meshStandardMaterial {...FRAME} />
            </mesh>

            {/* 빔 위 LED 조명 */}
            <mesh position={[-0.1, 0.74, -0.2]} castShadow>
              <boxGeometry args={[0.04, 0.02, 0.02]} />
              <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={0.6} />
            </mesh>
            <mesh position={[0.1, 0.74, -0.2]} castShadow>
              <boxGeometry args={[0.04, 0.02, 0.02]} />
              <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={0.6} />
            </mesh>

            {/* FIBC 백 (흰색 벌크백, 위 넓고 아래 둥근) */}
            <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.2, 0.15, 0.5, 16]} />
              <meshStandardMaterial
                color="#ffffff"
                metalness={0.05}
                roughness={0.9}
                transparent
                opacity={0.9}
              />
            </mesh>

            {/* 백 고정 스트랩 (상단에서 내려오는 선) */}
            <mesh position={[-0.12, 0.62, 0]} castShadow>
              <boxGeometry args={[0.03, 0.3, 0.02]} />
              <meshStandardMaterial {...FRAME} />
            </mesh>
            <mesh position={[0.12, 0.62, 0]} castShadow>
              <boxGeometry args={[0.03, 0.3, 0.02]} />
              <meshStandardMaterial {...FRAME} />
            </mesh>
          </group>
        );
      }
      default:
        return (
          <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.8, 1, 0.8]} />
            <meshStandardMaterial {...BODY_MAT} />
          </mesh>
        );
    }
  };

  const baseSize: [number, number, number] = isCalcination ? [3.8, 0.3, 2.6] : BASE_ARGS;
  const baseY = isCalcination ? 0.15 : 0.1;

  const { camera } = useThree();
  const zoom = (camera as THREE.OrthographicCamera)?.zoom ?? BASE_ZOOM;
  const zoomFactor = Math.max(0.5, Math.min(2.5, BASE_ZOOM / zoom));

  const labelY = isRawInput ? 4.85 : isCalcination ? 5.6 : 4.0;
  const anchorY = isRawInput ? 3.65 : frameH + 0.7;
  const labelOffsetZ =
    index >= 6 ? 1.2 + (index - 6) * 0.25 : index === 1 ? 1.25 : index === 2 ? 1.45 : 1.2;
  const baseLabelY =
    index >= 6 ? labelY + (index - 6) * MIN_LABEL_SPACING_Y : index === 1 ? labelY + 0.05 : index === 2 ? labelY + 0.15 : labelY;
  const zigzagOffset = (index % 2 === 0 ? -1 : 1) * ZIGZAG_AMPLITUDE * zoomFactor;
  const labelYFinal = baseLabelY + zigzagOffset;

  /** 공정명(01~09)은 항상 표시 - 패널 열림과 무관 */
  const labelPos: [number, number, number] = [0, labelYFinal, labelOffsetZ];
  const labelText = PROCESS_LABELS[stepName] ?? stepName;

  return (
    <group
      ref={groupRef}
      position={[pos.x, pos.y, pos.z]}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (isInteractive) setHovered(true);
        onPointerOver?.();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        if (isInteractive) setHovered(false);
        onPointerOut?.();
      }}
    >
      <SupportFrame width={frameW} depth={frameD} height={frameH} />
      {!isRawInput && (
        <mesh position={[0, frameH + baseY, 0]} castShadow receiveShadow>
          <boxGeometry args={baseSize} />
          <meshStandardMaterial {...BASE_MAT} />
        </mesh>
      )}
      <group position={[0, frameH, 0]}>{renderBody()}</group>
      <group position={[0, frameH, 0]}>
        <SafetyRailing width={frameW} depth={frameD} />
      </group>
      {/* 부유형 실시간 태그 (빌보드) - 클릭 시에만 표시 */}
      {machineDetail && showSensorTag && (
        <BillboardSensorTag
          position={[0, frameH + 0.85, 0.4]}
          equipmentId={machineDetail.id}
          isAnomaly={isAnomaly}
          fallbackTemp={machineDetail.temperature}
          fallbackStatus={
            machineDetail.status === '정상' || machineDetail.status === 'normal'
              ? '가동'
              : machineDetail.status === '주의' || machineDetail.status === 'warning'
                ? '주의'
                : '이상'
          }
        />
      )}
      <SolidConnectorLine from={[0, anchorY, 0]} to={labelPos} />
      {hasDefective && (
        <Html position={[0, frameH + 1.8, 0]} center style={{ zIndex: LABEL_Z_INDEX }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              background: '#dc2626',
              padding: '4px 10px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
            }}
          >
            [불량 발생]
          </div>
        </Html>
      )}
      <Html position={labelPos} center style={{ zIndex: LABEL_Z_INDEX }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#111827',
            background: '#e5e7eb',
            padding: '6px 16px',
            borderRadius: 9999,
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          }}
        >
          {labelText}
        </div>
      </Html>
    </group>
  );
}

/** 안전 난간: 밝은 노란색 (디지털 트윈 스타일) */
function SafetyRailing({ width, depth }: { width: number; depth: number }) {
  const railH = 0.25;
  const r = depth / 2 + 0.08;
  return (
    <group>
      <mesh position={[-width / 2, railH / 2, r]} castShadow>
        <boxGeometry args={[0.04, railH, 0.04]} />
        <meshStandardMaterial {...ACCENT_YELLOW} />
      </mesh>
      <mesh position={[width / 2, railH / 2, r]} castShadow>
        <boxGeometry args={[0.04, railH, 0.04]} />
        <meshStandardMaterial {...ACCENT_YELLOW} />
      </mesh>
      <mesh position={[0, railH / 2, r]} castShadow>
        <boxGeometry args={[width, 0.03, 0.03]} />
        <meshStandardMaterial {...ACCENT_YELLOW} />
      </mesh>
    </group>
  );
}

/** 사가(Sagger) 단일 박스 - 양극재 공정용 세라믹 용기 (축소형) */
function SaggerBox({ isDefective = false }: { isDefective?: boolean } = {}) {
  const CERAMIC = { color: '#d3d3d3', metalness: 0.05, roughness: 0.92 };
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.1, 0.05, 0.1]} />
        <meshStandardMaterial
          {...CERAMIC}
          emissive={isDefective ? '#991b1b' : '#000000'}
          emissiveIntensity={isDefective ? 0.08 : 0}
        />
      </mesh>
      {/* 내용물: 윗면 검은색 (양극재 가루) */}
      <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.096, 0.008, 0.096]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.1} roughness={0.9} />
      </mesh>
    </group>
  );
}

/** 사가 2x2 배치 (4개 세트) */
function SaggerBatch({ isDefective = false }: { isDefective?: boolean } = {}) {
  const offset = 0.06; // 0.1/2 + 0.01 간격
  return (
    <group>
      {([
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ] as const).map(([sx, sz], i) => (
        <group key={i} position={[sx * offset, 0, sz * offset]}>
          <SaggerBox isDefective={isDefective} />
        </group>
      ))}
    </group>
  );
}

/** 설비 사이 연결 파이프 (레이아웃 기준) */
function ConveyorPipe({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const vFrom = useMemo(() => new THREE.Vector3(...from), [from]);
  const vTo = useMemo(() => new THREE.Vector3(...to), [to]);
  const mid = useMemo(() => vFrom.clone().add(vTo).multiplyScalar(0.5), [vFrom, vTo]);
  const dir = useMemo(() => vTo.clone().sub(vFrom), [vFrom, vTo]);
  const len = useMemo(() => dir.length(), [dir]);
  const quat = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return q;
  }, [dir]);
  return (
    <mesh position={[mid.x, mid.y, mid.z]} quaternion={quat} castShadow>
      <cylinderGeometry args={[PIPE_RADIUS, PIPE_RADIUS, len, 12]} />
      <meshStandardMaterial {...PIPE_MAT} />
    </mesh>
  );
}

/** 바닥 그리드 (단순화·저투명도로 자글거림/모아레 감소, 설비가 돋보이도록) */
function LightGridFloor() {
  const gridSize = 5;
  const lineW = 0.018;
  const half = 10;
  const items: React.ReactNode[] = [];
  const gridColor = '#475569';
  const opacity = 0.2;
  for (let i = -half; i <= half; i++) {
    items.push(
      <mesh key={`gx-${i}`} position={[i * gridSize, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <boxGeometry args={[100, lineW, lineW]} />
        <meshBasicMaterial color={gridColor} transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-2} />
      </mesh>
    );
  }
  for (let j = -half; j <= half; j++) {
    items.push(
      <mesh key={`gz-${j}`} position={[0, 0.002, j * gridSize]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <boxGeometry args={[lineW, 100, lineW]} />
        <meshBasicMaterial color={gridColor} transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-2} />
      </mesh>
    );
  }
  return <group>{items}</group>;
}

/** 3D 공정 모니터링 씬 */
function Process3DScene({
  machineData: externalMachineData,
  sensorReadings = {},
  lastUpdated = null,
  onMachineClick,
  selectedMachineId,
  realtimeLots,
}: {
  machineData?: MachineDetail[];
  sensorReadings?: Record<string, { value: number; time: string }>;
  lastUpdated?: string | null;
  onMachineClick?: (m: MachineDetail) => void;
  selectedMachineId?: string | null;
  /** MariaDB 품질 데이터 기반 LOT (불량 시 해당 공정 빨간색 + 불량 LOT 빨간 구 이동) */
  realtimeLots?: RealtimeLot[];
} = {}) {
  const offsetX = -LAYOUT_CENTER_X;
  const offsetZ = -LAYOUT_CENTER_Z;

  /** 센서 태그(0°C·가동 등) 표시할 설비 index — 클릭 시에만 해당 설비 태그 표시 */
  const [pinnedSensorTagIndex, setPinnedSensorTagIndex] = useState<number | null>(null);

  const curveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const tubeGeoRef = useRef<THREE.TubeGeometry | null>(null);
  const safetyLineCurveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const safetyLineGeoRef = useRef<THREE.TubeGeometry | null>(null);
  if (!curveRef.current) {
    const points = LAYOUT.map((p) => new THREE.Vector3(p.x, p.y + 0.25, p.z));
    curveRef.current = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    tubeGeoRef.current = new THREE.TubeGeometry(curveRef.current, 50, 0.06, 8, false);
  }
  if (!safetyLineCurveRef.current) {
    const floorPoints = LAYOUT.map((p) => new THREE.Vector3(p.x, 0.015, p.z));
    safetyLineCurveRef.current = new THREE.CatmullRomCurve3(floorPoints, false, 'catmullrom', 0.5);
    safetyLineGeoRef.current = new THREE.TubeGeometry(safetyLineCurveRef.current, 80, 0.045, 8, false);
  }

  return (
    <>
      <Environment preset="warehouse" />

      {/* 에폭시 바닥 (빛 반사 - 공장 내부 질감) */}
      {/* 바닥 제거됨 */}

      {/* 스마트 팩토리 조명: 그림자 강화로 밀착감 */}
      <ambientLight intensity={0.45} color="#e2e8f0" />
      <directionalLight
        position={[15, 25, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadowCameraFar={80}
        shadowCameraLeft={-25}
        shadowCameraRight={25}
        shadowCameraTop={25}
        shadowCameraBottom={-25}
        color="#f8fafc"
      />
      <directionalLight position={[-10, 15, 5]} intensity={0.3} color="#94a3b8" />
      <pointLight position={[0, 12, 0]} intensity={0.4} color="#cbd5e1" distance={50} decay={2} />

      {/* ContactShadows 제거됨 */}

      {/* 소성로 근처 고온 열기 표현 (오렌지 PointLight) */}
      <pointLight
        position={[LAYOUT[3].x - LAYOUT_CENTER_X, 1.2, LAYOUT[3].z - LAYOUT_CENTER_Z]}
        color="#ff8c00"
        intensity={0.5}
        distance={8}
        decay={2}
      />

      <Bounds fit clip observe={false} margin={1.4}>
        <group position={[offsetX, 0, offsetZ]}>
          {/* 노란색 안전 가이드라인 (공정 라인 따라) */}
          <mesh position={[0, 0, 0]} geometry={safetyLineGeoRef.current!} receiveShadow renderOrder={0}>
            <meshStandardMaterial color="#eab308" metalness={0.1} roughness={0.85} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
          </mesh>
          {(externalMachineData ?? MOCK_MACHINE_DATA).map((item, i) => {
            const stepName = 'stepName' in item ? item.stepName : PROCESSES[i];
            const status: MachineStatus =
              'status' in item && ['normal', 'warning', 'error'].includes(item.status as string)
                ? (item.status as MachineStatus)
                : (item as MachineDetail).status === '정상'
                  ? 'normal'
                  : (item as MachineDetail).status === '주의'
                    ? 'warning'
                    : 'error';
            const detail = externalMachineData?.[i];
            return (
              <ProcessMachine
                key={i}
                stepName={stepName}
                isActive={false}
                index={i}
                status={status}
                machineDetail={detail}
                sensorReadings={sensorReadings}
                lastUpdated={lastUpdated}
                onClick={
                  detail && onMachineClick
                    ? () => {
                        onMachineClick(detail);
                        setPinnedSensorTagIndex((prev) => (prev === i ? null : i));
                      }
                    : undefined
                }
                isSelected={selectedMachineId != null && detail?.id === selectedMachineId}
                hasDefective={false}
                detailPanelOpen={selectedMachineId != null}
                showSensorTag={pinnedSensorTagIndex === i}
              />
            );
          })}
          {PROCESSES.slice(0, -1).map((_, i) => (
            <ConveyorPipe
              key={`pipe-${i}`}
              from={[LAYOUT[i].x, LAYOUT[i].y + 0.15, LAYOUT[i].z]}
              to={[LAYOUT[i + 1].x, LAYOUT[i + 1].y + 0.15, LAYOUT[i + 1].z]}
            />
          ))}
          {/* 메인 컨베이어 벨트 튜브 (경로 시각화) */}
          <mesh position={[0, 0.025, 0]} geometry={tubeGeoRef.current!} receiveShadow castShadow renderOrder={1}>
            <meshStandardMaterial color="#94a3b8" metalness={0.3} roughness={0.6} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
          </mesh>
          {/* 컨베이어 보조 라인 (벨트 연결감 강화) */}
          <mesh position={[0, 0.04, 0]} geometry={tubeGeoRef.current!} renderOrder={2}>
            <meshBasicMaterial color="#cbd5e1" transparent opacity={0.4} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
          </mesh>
          {/* 사가(Sagger) 2x2 세트 - 벨트 라인 따라 띄엄띄엄 배치 */}
          {Array.from({ length: 4 }, (_, i) => {
            const t = 0.12 + (i / 3) * 0.76;
            const pos = curveRef.current!.getPoint(t);
            return (
              <group key={`sagger-batch-${i}`} position={[pos.x, pos.y + 0.22, pos.z]}>
                <SaggerBatch />
              </group>
            );
          })}
        </group>
      </Bounds>
    </>
  );
}

// 설비 라인 정중앙 (그룹 offset으로 월드 원점이 레이아웃 중심과 일치)
const SCENE_CENTER: [number, number, number] = [0, 0.2, 0];

/** 3D 공정 모니터링 컴포넌트 */
export default function Process3D({
  machineData,
  onMachineClick,
  selectedMachineId,
  realtimeLots,
}: {
  machineData?: MachineDetail[];
  onMachineClick?: (m: MachineDetail) => void;
  selectedMachineId?: string | null;
  /** MariaDB 품질 데이터 기반 LOT (불량 시 해당 공정 빨간색 + 불량 LOT 빨간 구 이동·제거 연출) */
  realtimeLots?: RealtimeLot[];
} = {}) {
  const { sensorReadings, lastUpdated } = useSensorData();
  return (
    <div
      style={{
        width: '100%',
        height: 550,
        background: '#f1f5f9',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid #e2e8f0',
      }}
    >
      <Canvas orthographic shadows gl={{ antialias: true, alpha: false }} dpr={[1, 2]}>
        <color attach="background" args={['#f8fafc']} />
        <orthographicCamera makeDefault position={[50, 50, 50]} zoom={16} near={-100} far={200} />
        <Suspense fallback={null}>
          <Process3DScene
            machineData={machineData}
            sensorReadings={sensorReadings}
            lastUpdated={lastUpdated}
            onMachineClick={onMachineClick}
            selectedMachineId={selectedMachineId}
            realtimeLots={realtimeLots}
          />
          <OrbitControls
            target={SCENE_CENTER}
            enableZoom={true}
            enablePan={true}
            enableDamping
            dampingFactor={0.05}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2.2}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

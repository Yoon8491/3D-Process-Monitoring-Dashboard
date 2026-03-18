'use client';

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, Line, Environment, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

type LotInfo = { lotId: string; passFailResult: string | null };

// 장치에 점 + 대시라인으로 연결된 라벨 (겹침 방지)
function EquipmentLabel({
  equipmentPos,
  labelPos,
  text,
}: {
  equipmentPos: [number, number, number];
  labelPos: [number, number, number];
  text: string;
}) {
  const points = useMemo(
    () => [new THREE.Vector3(...equipmentPos), new THREE.Vector3(...labelPos)],
    [equipmentPos, labelPos]
  );
  return (
    <group>
      <mesh position={equipmentPos}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>
      <Line points={points} color="#3b82f6" lineWidth={1.5} dashed />
      <Html position={labelPos} center>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#1e40af',
            background: 'rgba(255,255,255,0.95)',
            padding: '4px 10px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            border: '1px solid #93c5fd',
          }}
        >
          {text}
        </div>
      </Html>
    </group>
  );
}

// LOT 경로 (왼쪽→오른쪽, 컨베이어 벨트 위)
const PATH: { x: number; y: number; z: number }[] = [
  { x: -24, y: 0.45, z: 0 },
  { x: -20, y: 0.45, z: 0 },
  { x: -14, y: 0.45, z: 0 },
  { x: -8, y: 0.45, z: 0 },
  { x: 0, y: 0.45, z: 0 },
  { x: 8, y: 0.45, z: 0 },
  { x: 14, y: 0.95, z: 0 },
  { x: 18, y: 0.95, z: 0 },
  { x: 24, y: 0.95, z: 0 },
];

function LotBox({
  progress,
  lotId,
  isDefect,
}: {
  progress: number;
  lotId: string;
  isDefect: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const currentPos = useRef({ x: PATH[0].x, y: PATH[0].y, z: PATH[0].z });

  // 목표 위치 계산
  const idx = Math.min(
    Math.floor(progress * (PATH.length - 1)),
    PATH.length - 2
  );
  const t = (progress * (PATH.length - 1)) % 1;
  const p1 = PATH[idx];
  const p2 = PATH[idx + 1];
  const targetX = p1.x + (p2.x - p1.x) * t;
  const targetY = p1.y + (p2.y - p1.y) * t;
  const targetZ = p1.z + (p2.z - p1.z) * t;

  // 부드러운 보간 (lerp)
  useFrame(() => {
    if (meshRef.current) {
      const lerpFactor = 0.08;
      currentPos.current.x += (targetX - currentPos.current.x) * lerpFactor;
      currentPos.current.y += (targetY - currentPos.current.y) * lerpFactor;
      currentPos.current.z += (targetZ - currentPos.current.z) * lerpFactor;
      meshRef.current.position.set(
        currentPos.current.x,
        currentPos.current.y,
        currentPos.current.z
      );
    }
  });

  const color = isDefect ? '#ef4444' : '#10b981';

  return (
    <mesh ref={meshRef} position={[targetX, targetY, targetZ]} castShadow receiveShadow>
      <boxGeometry args={[0.8, 0.6, 0.6]} />
      <meshStandardMaterial 
        color={color} 
        metalness={0.35} 
        roughness={0.45}
        envMapIntensity={0.8}
      />
      <Html position={[0, 0.5, 0]} center style={{ pointerEvents: 'none' }}>
        <span
          style={{
            fontSize: 9,
            color: 'white',
            fontWeight: 'bold',
            textShadow: '0 1px 2px #000',
          }}
        >
          {String(lotId).slice(-3)}
        </span>
      </Html>
    </mesh>
  );
}

// 원재료 투입 + 정밀 계량 및 혼합 (다단 구조: 호퍼 → 혼합기)
function RawMaterialSection() {
  return (
    <group position={[-20, 0, 0]}>
      {/* 상단: 호퍼 2개 (노란색, 실제 장비 형태) */}
      <mesh position={[-1.2, 3.2, 0]} castShadow>
        <cylinderGeometry args={[0.6, 0.9, 1.8, 16]} />
        <meshStandardMaterial color="#facc15" metalness={0.45} roughness={0.35} envMapIntensity={0.7} />
      </mesh>
      <mesh position={[1.2, 3.2, 0]} castShadow>
        <cylinderGeometry args={[0.6, 0.9, 1.8, 16]} />
        <meshStandardMaterial color="#facc15" metalness={0.45} roughness={0.35} envMapIntensity={0.7} />
      </mesh>
      {/* 호퍼 하부 연결 슈트 */}
      <mesh position={[-1.2, 2, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.6, 0.8, 12]} />
        <meshStandardMaterial color="#eab308" metalness={0.5} roughness={0.3} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[1.2, 2, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.6, 0.8, 12]} />
        <meshStandardMaterial color="#eab308" metalness={0.5} roughness={0.3} envMapIntensity={0.6} />
      </mesh>
      {/* 하단: 혼합기 (회색 원통형 본체 + 파란 모터/배관) */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[1.4, 1.4, 1.8, 20]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.35} roughness={0.55} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[0, 1.2, 1.1]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.6, 12]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.6} roughness={0.3} envMapIntensity={0.7} />
      </mesh>
      <mesh position={[0.5, 1.5, 0.9]} castShadow>
        <boxGeometry args={[0.35, 0.35, 0.35]} />
        <meshStandardMaterial color="#2563eb" metalness={0.6} roughness={0.3} envMapIntensity={0.7} />
      </mesh>
      <mesh position={[-0.6, 1.4, 0.95]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.4, 8]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.55} roughness={0.35} envMapIntensity={0.6} />
      </mesh>
    </group>
  );
}

// 충진 (컨베이어 + 사각형 베이스 + 원통형 장치)
function FillingSection() {
  return (
    <group position={[-12, 0, 0]}>
      {/* 컨베이어 벨트 */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.5, 0.08, 1.6]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.2} roughness={0.7} envMapIntensity={0.4} />
      </mesh>
      {/* 컨베이어 프레임 */}
      <mesh position={[-1.5, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 1.6, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.4} roughness={0.5} envMapIntensity={0.5} />
      </mesh>
      <mesh position={[1.5, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 1.6, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.4} roughness={0.5} envMapIntensity={0.5} />
      </mesh>
      {/* 충진 장치: 사각형 베이스 */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.2, 0.6, 1]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.3} roughness={0.6} envMapIntensity={0.5} />
      </mesh>
      {/* 충진 장치: 원통형 컴포넌트 */}
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.8, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.35} roughness={0.55} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[0.4, 1.2, 0.5]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.35, 8]} />
        <meshStandardMaterial color="#facc15" metalness={0.5} roughness={0.4} envMapIntensity={0.6} />
      </mesh>
    </group>
  );
}

// 소성 (GLB 모델 로드)
function SinteringSection() {
  const { scene } = useGLTF('/sintering-line.glb');
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return (
    <group position={[-4, 0, 0]} scale={[1.2, 1.2, 1.2]} rotation={[0, Math.PI / 2, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

// 조분쇄, 전자석 탈철, 미분쇄 (2단 플랫폼, 원통형+파란리드+노란배관)
function GrindingSection() {
  return (
    <group position={[8, 0.5, 0]}>
      {/* 하단 플랫폼 */}
      <mesh position={[0, 0.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[8.5, 0.25, 2.8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.35} roughness={0.55} envMapIntensity={0.5} />
      </mesh>
      {/* 조분쇄: 원통형 본체 + 파란 리드 + 노란 배관 */}
      <mesh position={[-2.5, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.75, 0.75, 1.3, 20]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.4} roughness={0.5} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[-2.5, 1.5, 0.65]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.2, 12]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.6} roughness={0.3} envMapIntensity={0.7} />
      </mesh>
      <mesh position={[-2.2, 1.35, 0.55]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.4, 8]} />
        <meshStandardMaterial color="#facc15" metalness={0.5} roughness={0.4} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[-2.8, 1.2, 0.5]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.35, 8]} />
        <meshStandardMaterial color="#facc15" metalness={0.5} roughness={0.4} envMapIntensity={0.6} />
      </mesh>
      {/* 전자석 탈철: 사각형 본체 + 파란 모터 */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[0.9, 0.9, 1.1]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.85, 0.65]} castShadow>
        <boxGeometry args={[0.35, 0.35, 0.25]} />
        <meshStandardMaterial color="#2563eb" metalness={0.6} roughness={0.3} envMapIntensity={0.7} />
      </mesh>
      <mesh position={[0.45, 0.7, 0.6]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.25, 8]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.6} roughness={0.3} envMapIntensity={0.7} />
      </mesh>
      {/* 미분쇄: 조분쇄와 유사 형태 */}
      <mesh position={[2.5, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.75, 0.75, 1.3, 20]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.4} roughness={0.5} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[2.5, 1.5, 0.65]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.2, 12]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.6} roughness={0.3} envMapIntensity={0.7} />
      </mesh>
      <mesh position={[2.8, 1.35, 0.55]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.4, 8]} />
        <meshStandardMaterial color="#facc15" metalness={0.5} roughness={0.4} envMapIntensity={0.6} />
      </mesh>
    </group>
  );
}

// 체거름 (호퍼형 상단 + 진동 스크린 하부 + 파란 악센트)
function SievingSection() {
  return (
    <group position={[14, 0.5, 0]}>
      {/* 상단 호퍼 */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <coneGeometry args={[0.85, 1.3, 18]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.35} roughness={0.55} envMapIntensity={0.6} />
      </mesh>
      {/* 중간 연결부 */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.85, 0.6, 14]} />
        <meshStandardMaterial color="#64748b" metalness={0.4} roughness={0.5} envMapIntensity={0.6} />
      </mesh>
      {/* 하부 진동 스크린 (사각형 + 파란 장치) */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[1.4, 0.35, 1.2]} />
        <meshStandardMaterial color="#64748b" metalness={0.4} roughness={0.5} envMapIntensity={0.5} />
      </mesh>
      <mesh position={[0.5, 0.5, 0.7]} castShadow>
        <boxGeometry args={[0.3, 0.2, 0.15]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.6} roughness={0.3} envMapIntensity={0.7} />
      </mesh>
    </group>
  );
}

// 포장 (플랫폼 + 포장기)
function PackagingSection() {
  return (
    <group position={[20, 0, 0]}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.2, 1.6]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.2} roughness={0.7} envMapIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[1.4, 0.6, 1]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.35} roughness={0.55} envMapIntensity={0.5} />
      </mesh>
      <mesh position={[0.5, 0.9, 0.55]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.15, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.45} roughness={0.45} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[-0.4, 0.55, 0]} castShadow>
        <boxGeometry args={[0.5, 0.35, 0.5]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.25} roughness={0.65} envMapIntensity={0.4} />
      </mesh>
    </group>
  );
}

// 깔끔한 흰색 바닥
function WhiteFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[60, 40]} />
      <meshStandardMaterial color="#f8fafc" roughness={0.9} metalness={0.05} envMapIntensity={0.3} />
    </mesh>
  );
}

// 메인 컨베이어 벨트 (전체 공정 라인)
function MainConveyorBelt() {
  const rollersRef = useRef<THREE.Group>(null);

  // 롤러 회전 애니메이션
  useFrame((_, delta) => {
    if (rollersRef.current) {
      rollersRef.current.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          child.rotation.z += delta * 2;
        }
      });
    }
  });

  const rollerPositions = [];
  for (let x = -22; x <= 22; x += 2) {
    rollerPositions.push(x);
  }

  return (
    <group>
      {/* 메인 벨트 표면 */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[48, 0.06, 1.2]} />
        <meshStandardMaterial 
          color="#374151" 
          metalness={0.1} 
          roughness={0.85}
          envMapIntensity={0.4}
        />
      </mesh>
      {/* 벨트 프레임 (양쪽) */}
      <mesh position={[0, 0.06, 0.65]} castShadow>
        <boxGeometry args={[48, 0.12, 0.08]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.06, -0.65]} castShadow>
        <boxGeometry args={[48, 0.12, 0.08]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} envMapIntensity={0.6} />
      </mesh>
      {/* 롤러들 (회전 애니메이션) */}
      <group ref={rollersRef}>
        {rollerPositions.map((x, i) => (
          <mesh key={i} position={[x, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 1.1, 12]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.3} envMapIntensity={0.7} />
          </mesh>
        ))}
      </group>
      {/* 지지대 다리 */}
      {[-20, -10, 0, 10, 20].map((x, i) => (
        <group key={i}>
          <mesh position={[x, -0.15, 0.5]} castShadow>
            <boxGeometry args={[0.15, 0.3, 0.15]} />
            <meshStandardMaterial color="#475569" metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[x, -0.15, -0.5]} castShadow>
            <boxGeometry args={[0.15, 0.3, 0.15]} />
            <meshStandardMaterial color="#475569" metalness={0.4} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ProcessScene({
  lots,
  lotProgress,
  language,
}: {
  lots: LotInfo[];
  lotProgress: Record<string, number>;
  language: string;
}) {
  const labelConfig = [
    { id: 'input', ko: '원재료 투입', en: 'Raw Material Input', anchor: [-20, 4, 0.5] as [number, number, number], label: [-20, 5, 0.5] as [number, number, number] },
    { id: 'weigh', ko: '정밀 계량 및 혼합', en: 'Precision Weighing & Mixing', anchor: [-20, 2, 0.8] as [number, number, number], label: [-20, 3, 0.8] as [number, number, number] },
    { id: 'fill', ko: '충진', en: 'Filling', anchor: [-12, 1.6, 0.8] as [number, number, number], label: [-12, 2.5, 0.8] as [number, number, number] },
    { id: 'sinter', ko: '소성 (Sintering)', en: 'Sintering', anchor: [-4, 1.8, 1.2] as [number, number, number], label: [-4, 2.8, 1.2] as [number, number, number] },
    { id: 'coarse', ko: '조분쇄', en: 'Coarse Grinding', anchor: [5.5, 2, 0.8] as [number, number, number], label: [5.5, 3, 0.8] as [number, number, number] },
    { id: 'iron', ko: '전자석 탈철', en: 'Iron Removal', anchor: [8, 1.6, 0.8] as [number, number, number], label: [8, 2.6, 0.8] as [number, number, number] },
    { id: 'fine', ko: '미분쇄', en: 'Fine Grinding', anchor: [10.5, 2, 0.8] as [number, number, number], label: [10.5, 3, 0.8] as [number, number, number] },
    { id: 'screen', ko: '체거름', en: 'Sieving', anchor: [14, 2.2, 0.9] as [number, number, number], label: [14, 3.2, 0.9] as [number, number, number] },
    { id: 'pack', ko: '포장', en: 'Packaging', anchor: [20, 1.5, 0.8] as [number, number, number], label: [20, 2.5, 0.8] as [number, number, number] },
  ];

  return (
    <>
      <color attach="background" args={['#f1f5f9']} />
      
      {/* 환경 조명 (HDRI 기반 반사광) */}
      <Environment preset="warehouse" background={false} />
      
      {/* 카메라 컨트롤 */}
      <OrbitControls
        enableZoom={true}
        enablePan={true}
        enableDamping
        dampingFactor={0.05}
        minDistance={15}
        maxDistance={60}
        maxPolarAngle={Math.PI / 2 - 0.1}
      />
      
      {/* 조명 설정 */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[15, 25, 15]} 
        intensity={1.5} 
        castShadow 
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.1}
        shadow-camera-far={60}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-10, 15, -10]} intensity={0.4} />
      <hemisphereLight args={['#b0d4ff', '#f0f0f0', 0.5]} />
      
      {/* 바닥 접촉 그림자 (부드러운 그림자 효과) */}
      <ContactShadows 
        position={[0, -0.01, 0]} 
        opacity={0.35} 
        scale={60} 
        blur={2.5} 
        far={15}
      />

      <WhiteFloor />
      <MainConveyorBelt />
      <RawMaterialSection />
      <FillingSection />
      <SinteringSection />
      <GrindingSection />
      <SievingSection />
      <PackagingSection />

      {labelConfig.map((l) => (
        <EquipmentLabel
          key={l.id}
          equipmentPos={l.anchor}
          labelPos={l.label}
          text={language === 'ko' ? l.ko : l.en}
        />
      ))}

      {lots.map((lot) => (
        <LotBox
          key={lot.lotId}
          progress={lotProgress[lot.lotId] ?? 0}
          lotId={lot.lotId}
          isDefect={lot.passFailResult === '불합격'}
        />
      ))}
    </>
  );
}

export default function ProcessModel3D({
  lots,
  lotProgress,
  language,
}: {
  lots: LotInfo[];
  lotProgress: Record<string, number>;
  language: string;
}) {
  return (
    <div style={{ width: '100%', height: 550, background: '#f1f5f9', borderRadius: 8 }}>
      <Canvas
        shadows
        camera={{ position: [0, 10, 28], fov: 42 }}
        gl={{ 
          antialias: true, 
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <ProcessScene lots={lots} lotProgress={lotProgress} language={language} />
        </Suspense>
      </Canvas>
    </div>
  );
}

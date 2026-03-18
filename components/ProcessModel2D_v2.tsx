'use client';

type LotInfo = { lotId: string; passFailResult: string | null };

const STAGES: { id: string; ko: string; en: string; left: string; width: string }[] = [
  { id: 'input', ko: '원재료 투입', en: 'Raw Material Input', left: '0%', width: '10%' },
  { id: 'weigh', ko: '정밀 계량 및 혼합', en: 'Precision Weighing & Mixing', left: '10%', width: '12%' },
  { id: 'fill', ko: '충진', en: 'Filling', left: '22%', width: '10%' },
  { id: 'sinter', ko: '소성', en: 'Sintering', left: '32%', width: '22%' },
  { id: 'coarse', ko: '조분쇄', en: 'Coarse Grinding', left: '54%', width: '10%' },
  { id: 'iron', ko: '전자석 탈철', en: 'Iron Removal', left: '64%', width: '10%' },
  { id: 'fine', ko: '미분쇄', en: 'Fine Grinding', left: '74%', width: '10%' },
  { id: 'screen', ko: '체거름', en: 'Sieving', left: '84%', width: '8%' },
  { id: 'pack', ko: '포장', en: 'Packaging', left: '92%', width: '8%' },
];

const DURATION = 20;
const RAIL_TOP = 44;
const RAIL_H = 40;
const EQUIP_H = 56;
const LABEL_DASHED_H = 28;
const EQUIP_TOP = RAIL_TOP + RAIL_H / 2 - LABEL_DASHED_H - EQUIP_H / 2;

function LotBox({ lotId, isDefect, index }: { lotId: string; isDefect: boolean; index: number }) {
  const color = isDefect ? '#94a3b8' : '#3b82f6';
  const delay = (index / Math.max(1, 12)) * DURATION * 0.8;
  return (
    <div
      className="absolute rounded-full flex items-center justify-center text-[6px] font-bold text-white border-2 border-blue-600/60 shadow-md z-[5]"
      style={{
        backgroundColor: color,
        width: 16,
        height: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        animation: `lotMove2 ${DURATION}s linear infinite`,
        animationDelay: `-${delay}s`,
      }}
      title={`${lotId} (${isDefect ? '불합격' : '합격'})`}
    >
      {String(lotId).slice(-2)}
    </div>
  );
}

function EquipmentBlock({
  stage,
  language,
  children,
}: {
  stage: (typeof STAGES)[0];
  language: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute flex flex-col items-center z-10 pointer-events-none"
      style={{ left: stage.left, width: stage.width }}
    >
      <div
        className="border border-blue-300 rounded px-1 py-0.5 bg-blue-100 shadow-sm text-center mb-1 shrink-0"
        style={{ fontSize: 8, fontWeight: 600, color: '#1e40af' }}
      >
        {language === 'ko' ? stage.ko : stage.en}
      </div>
      <div className="shrink-0" style={{ width: 0, height: 8, borderLeft: '1px dashed #93c5fd' }} />
      <div className="relative w-full" style={{ minHeight: 90 }}>
        {children}
      </div>
    </div>
  );
}

export default function ProcessModel2D_v2({
  lots,
  language,
}: {
  lots: LotInfo[];
  lotProgress?: Record<string, number>;
  language: string;
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes lotMove2 {
          0% { left: 1%; }
          100% { left: 98%; }
        }
      `}} />
      <div
        className="w-full rounded-xl border border-slate-200 overflow-hidden min-h-[240px]"
        style={{
          backgroundColor: '#e0f2fe',
          backgroundImage: `
            linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: '12px 12px',
        }}
      >
        <div className="relative mx-4 my-5" style={{ minHeight: 180 }}>
          {/* 그림자 (레일 아래) */}
          <div
            className="absolute left-2 right-2 rounded-lg z-0 opacity-40"
            style={{
              top: RAIL_TOP + RAIL_H + 4,
              height: 8,
              background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
              filter: 'blur(2px)',
            }}
          />
          {/* 레일 (3D 입체감 - 사진 스타일) */}
          <div
            className="absolute left-0 right-0 rounded-lg z-0"
            style={{
              top: RAIL_TOP,
              height: RAIL_H,
              background: 'linear-gradient(180deg, #94a3b8 0%, #64748b 30%, #475569 50%, #334155 100%)',
              border: '1px solid #475569',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.2)',
              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(0,0,0,0.08) 6px, rgba(0,0,0,0.08) 8px)',
            }}
          />

          {/* 1. 원재료 투입 */}
          <EquipmentBlock stage={STAGES[0]} language={language}>
            <div className="absolute top-0 left-0 right-0 h-2 bg-amber-200 border border-amber-400 rounded" />
            <div className="absolute left-0 right-0 flex justify-center gap-2 z-10" style={{ top: EQUIP_TOP, height: EQUIP_H }}>
              <div className="w-9 h-[56px] flex flex-col rounded-b overflow-hidden border-2 border-slate-500 z-10">
                <div className="h-3 bg-blue-200 border-b border-blue-400" style={{ clipPath: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)' }} />
                <div className="flex-1 bg-slate-400" />
              </div>
              <div className="w-9 h-[56px] flex flex-col rounded-b overflow-hidden border-2 border-slate-500 z-10">
                <div className="h-3 bg-blue-200 border-b border-blue-400" style={{ clipPath: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)' }} />
                <div className="flex-1 bg-slate-400" />
              </div>
            </div>
          </EquipmentBlock>

          <EquipmentBlock stage={STAGES[1]} language={language}>
            <div className="absolute left-1/2 -translate-x-1/2 w-12 bg-slate-400 border-2 border-slate-600 rounded flex items-center justify-center z-10" style={{ top: EQUIP_TOP, height: EQUIP_H }}>
              <div className="w-3 h-3 rounded-full bg-slate-200 border border-slate-400" />
            </div>
          </EquipmentBlock>

          <EquipmentBlock stage={STAGES[2]} language={language}>
            <div className="absolute left-0 right-0 bg-slate-300 border-2 border-slate-400 rounded flex flex-col items-center justify-center z-10" style={{ top: EQUIP_TOP, height: EQUIP_H }}>
              <div className="w-3 h-3 rounded-full bg-slate-500 mb-1" />
            </div>
          </EquipmentBlock>

          {/* 4. 소성: 터널형 (레일이 내부 통과, 레일 안 보임) */}
          <EquipmentBlock stage={STAGES[3]} language={language}>
            <div className="absolute left-0 right-0 bg-stone-400 border-2 border-stone-500 rounded flex items-center justify-center z-10" style={{ top: EQUIP_TOP, height: EQUIP_H }}>
              <span className="text-[9px] font-bold text-stone-600">Sintering</span>
            </div>
          </EquipmentBlock>

          <EquipmentBlock stage={STAGES[4]} language={language}>
            <div className="absolute left-1/2 -translate-x-1/2 w-12 bg-slate-400 border-2 border-slate-600 rounded-b-full flex items-center justify-center z-10" style={{ top: EQUIP_TOP, height: EQUIP_H }}>
              <div className="w-2 h-2 rounded-full bg-slate-200 border border-slate-400" />
            </div>
          </EquipmentBlock>

          <EquipmentBlock stage={STAGES[5]} language={language}>
            <div className="absolute left-1/2 -translate-x-1/2 w-12 bg-slate-500 border-2 border-slate-600 rounded flex items-center justify-center z-10" style={{ top: EQUIP_TOP, height: EQUIP_H }}>
              <div className="w-3 h-2 rounded border-2 border-blue-400 bg-blue-100" />
            </div>
          </EquipmentBlock>

          <EquipmentBlock stage={STAGES[6]} language={language}>
            <div className="absolute left-1/2 -translate-x-1/2 w-11 bg-slate-400 border-2 border-slate-600 rounded-b-full z-10" style={{ top: EQUIP_TOP, height: EQUIP_H }} />
          </EquipmentBlock>

          <EquipmentBlock stage={STAGES[7]} language={language}>
            <div className="absolute left-0 right-0 flex flex-col rounded overflow-hidden border-2 border-slate-400 z-10" style={{ top: EQUIP_TOP, height: EQUIP_H }}>
              <div className="flex-1 bg-slate-100 border-b border-slate-300" />
              <div className="flex-1 bg-blue-200 border-t border-blue-400" />
            </div>
          </EquipmentBlock>

          <EquipmentBlock stage={STAGES[8]} language={language}>
            <div className="absolute left-1/2 -translate-x-1/2 w-12 bg-slate-300 border-2 border-slate-500 rounded flex flex-col items-center justify-center pt-2 z-10" style={{ top: EQUIP_TOP, height: EQUIP_H }}>
              <div className="w-3 h-2 bg-slate-500 rounded" />
            </div>
          </EquipmentBlock>

          {/* LOT 이동 트랙 */}
          <div
            className="absolute left-0 right-0 rounded-lg z-[4]"
            style={{ top: RAIL_TOP, height: RAIL_H }}
          >
            {lots.map((lot, i) => (
              <LotBox
                key={lot.lotId}
                lotId={lot.lotId}
                isDefect={lot.passFailResult === '불합격'}
                index={i}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-6 py-2 border-t border-slate-200/80 bg-white/50">
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-600" />
            {language === 'ko' ? '합격 LOT' : 'Pass'}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-3 h-3 rounded-full bg-slate-400 border-2 border-slate-500" />
            {language === 'ko' ? '불합격 LOT' : 'Fail'}
          </span>
        </div>
      </div>
    </>
  );
}

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
const LABEL_DASHED_H = 28; // 라벨+점선 높이
const EQUIP_TOP = RAIL_TOP + RAIL_H / 2 - LABEL_DASHED_H - EQUIP_H / 2; // 장비 중앙이 레일 중앙과 일치

function LotBox({ lotId, isDefect, index }: { lotId: string; isDefect: boolean; index: number }) {
  const color = isDefect ? '#ef4444' : '#10b981';
  const delay = (index / Math.max(1, 12)) * DURATION * 0.8;
  return (
    <div
      className="absolute w-6 h-4 rounded flex items-center justify-center text-[7px] font-bold text-white border shadow-md z-[5]"
      style={{
        backgroundColor: color,
        borderColor: isDefect ? '#dc2626' : '#059669',
        top: '50%',
        transform: 'translateY(-50%)',
        animation: `lotMove ${DURATION}s linear infinite`,
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

export default function ProcessModel2D({
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
        @keyframes lotMove {
          0% { left: 1%; }
          100% { left: 98%; }
        }
      `}} />
      <div className="w-full bg-[#fafafa] rounded-xl border border-slate-200 overflow-hidden min-h-[240px]">
        <div className="relative mx-4 my-5" style={{ minHeight: 180 }}>
          {/* 레일 (배경) - 장비 아래에서만 가려짐 */}
          <div
            className="absolute left-0 right-0 rounded-lg bg-slate-400 border-2 border-slate-500 z-0"
            style={{
              top: RAIL_TOP,
              height: RAIL_H,
              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(0,0,0,0.06) 6px, rgba(0,0,0,0.06) 8px)',
            }}
          />

          {/* 1. 원재료 투입: 호퍼 (다리 없음, 레일 완전 가림) */}
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

          <EquipmentBlock stage={STAGES[3]} language={language}>
            <div className="absolute left-0 right-0 flex z-10" style={{ top: EQUIP_TOP, height: EQUIP_H }}>
              {/* 왼쪽 끝: 그루브 있는 롤러 */}
              <div
                className="w-[15%] min-w-[20px] rounded-l border-l border-t border-b border-slate-600 bg-slate-500"
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 3px)',
                }}
              />
              {/* 중앙: 매끄러운 본체 */}
              <div className="flex-1 rounded-t bg-slate-200/90 border-t border-x border-slate-400 shadow-sm" />
              {/* 오른쪽 끝: 그루브 있는 롤러 */}
              <div
                className="w-[15%] min-w-[20px] rounded-r border-r border-t border-b border-slate-600 bg-slate-500"
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 3px)',
                }}
              />
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

        <div className="flex justify-center gap-6 py-2 border-t border-slate-200">
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-3 h-2 rounded-sm bg-emerald-500 border border-emerald-600" />
            {language === 'ko' ? '합격 LOT' : 'Pass'}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-3 h-2 rounded-sm bg-red-500 border border-red-600" />
            {language === 'ko' ? '불합격 LOT' : 'Fail'}
          </span>
        </div>
      </div>
    </>
  );
}

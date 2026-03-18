'use client';

import { useEffect, useState } from 'react';

type LotInfo = {
  lotId: string;
  passFailResult: string | null;
  processTime: number | null;
};

type ProcessStepLotsProps = {
  lots: LotInfo[];
  lotProgress: Record<string, number>;
  language: string;
};

const PROCESS_STEPS = [
  { id: '01', ko: '재료 투입', en: 'Material Input' },
  { id: '02', ko: '정밀 계량 및 혼합', en: 'Precision Weighing and Mixing' },
  { id: '03', ko: '충진', en: 'Filling' },
  { id: '04', ko: '소성', en: 'Firing/Calcination' },
  { id: '05', ko: '조분쇄', en: 'Coarse Grinding' },
  { id: '06', ko: '전자석 달철', en: 'Electromagnetic Iron Removal' },
  { id: '07', ko: '미분쇄', en: 'Fine Grinding' },
  { id: '08', ko: '체거름', en: 'Sieving' },
  { id: '09', ko: '포장', en: 'Packaging' },
];

export default function ProcessStepLots({ lots, lotProgress, language }: ProcessStepLotsProps) {
  const [stepLots, setStepLots] = useState<Record<string, { accepted: number; rejected: number }>>({});
  const [animatedCounts, setAnimatedCounts] = useState<Record<string, { accepted: number; rejected: number }>>({});

  useEffect(() => {
    // 각 공정 단계별 LOT 분포 계산 (lotProgress 기반)
    const stepCounts: Record<string, { accepted: number; rejected: number }> = {};
    
    PROCESS_STEPS.forEach((step) => {
      stepCounts[step.id] = { accepted: 0, rejected: 0 };
    });

    lots.forEach((lot) => {
      const progress = lotProgress[lot.lotId] ?? 0;
      // progress를 0~1 범위에서 0~9 단계로 변환
      const stepIndex = Math.min(Math.floor(progress * PROCESS_STEPS.length), PROCESS_STEPS.length - 1);
      const stepId = PROCESS_STEPS[stepIndex]?.id || '01';
      
      if (lot.passFailResult === '합격' || lot.passFailResult === 'PASS') {
        stepCounts[stepId].accepted++;
      } else if (lot.passFailResult === '불합격' || lot.passFailResult === 'FAIL') {
        stepCounts[stepId].rejected++;
      } else {
        // 결과가 없으면 합격으로 간주
        stepCounts[stepId].accepted++;
      }
    });

    setStepLots(stepCounts);
    
    // 애니메이션: 숫자가 부드럽게 증가/감소하도록
    const animationDuration = 500; // 0.5초
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      const newAnimated: Record<string, { accepted: number; rejected: number }> = {};
      PROCESS_STEPS.forEach((step) => {
        const target = stepCounts[step.id];
        const current = animatedCounts[step.id] || { accepted: 0, rejected: 0 };
        
        newAnimated[step.id] = {
          accepted: Math.round(current.accepted + (target.accepted - current.accepted) * progress),
          rejected: Math.round(current.rejected + (target.rejected - current.rejected) * progress),
        };
      });
      
      setAnimatedCounts(newAnimated);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [lots, lotProgress]);

  const totalLots = lots.length;

  return (
    <div className="bg-slate-900 rounded-lg p-6 overflow-x-auto">
      <h3 className="text-white text-lg font-semibold mb-4">
        {language === 'ko' ? '공정 단계별 연결 상태 및 LOT 현황' : 'Connection Status and LOT Status by Process Step'}
      </h3>
      
      <div className="flex items-start gap-2 min-w-max">
        {PROCESS_STEPS.map((step, index) => {
          const counts = animatedCounts[step.id] || { accepted: 0, rejected: 0 };
          const hasLots = counts.accepted > 0 || counts.rejected > 0;
          
          return (
            <div key={step.id} className="flex flex-col items-center relative">
              {/* 공정 단계 카드 */}
              <div className="bg-slate-800 rounded-lg p-4 min-w-[140px] border border-slate-700">
                <div className="text-cyan-400 text-lg font-bold mb-2">{step.id}</div>
                <div className="text-white text-xs mb-3 leading-tight">
                  {language === 'ko' ? step.ko : step.en}
                </div>
                
                {/* LOT 표시 영역 */}
                <div className="flex flex-wrap gap-1.5 justify-center min-h-[60px]">
                  {counts.accepted > 0 && (
                    <div className="flex items-center justify-center w-8 h-8 bg-green-600 rounded text-white text-xs font-bold border border-green-500">
                      {counts.accepted}
                    </div>
                  )}
                  {counts.rejected > 0 && (
                    <div className="flex items-center justify-center w-8 h-8 bg-red-600 rounded text-white text-xs font-bold border border-red-500">
                      {counts.rejected}
                    </div>
                  )}
                  {!hasLots && (
                    <div className="text-slate-500 text-xs">-</div>
                  )}
                </div>
              </div>
              
              {/* 연결선 (마지막 단계 제외) */}
              {index < PROCESS_STEPS.length - 1 && (
                <>
                  {/* 상단 연결선 */}
                  <div className="absolute top-6 left-full w-4 h-0.5 bg-cyan-400 z-0" />
                  {/* 하단 연결선 */}
                  <div className="absolute bottom-6 left-full w-4 h-0.5 bg-cyan-400 z-0" />
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 범례 및 총 LOT 수 */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-600 rounded border border-green-500"></div>
            <span className="text-white text-sm">{language === 'ko' ? '합격 LOT' : 'Accepted LOT'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-600 rounded border border-red-500"></div>
            <span className="text-white text-sm">{language === 'ko' ? '불합격 LOT' : 'Rejected LOT'}</span>
          </div>
        </div>
        <div className="text-white text-sm font-semibold">
          {totalLots} LOT
        </div>
      </div>
    </div>
  );
}

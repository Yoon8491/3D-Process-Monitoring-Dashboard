'use client';

/** 로컬/테스트용 더미 차트 (Spotfire URL·경로 미설정 또는 에러 시 표시) */
export default function SpotfireMockChart({
  height = 420,
  message,
  className = '',
}: {
  height?: number;
  message?: string;
  className?: string;
}) {
  const mockData = [
    { label: '1월', value: 82, color: 'rgb(59 130 246)' },
    { label: '2월', value: 75, color: 'rgb(96 165 250)' },
    { label: '3월', value: 90, color: 'rgb(59 130 246)' },
    { label: '4월', value: 68, color: 'rgb(147 197 253)' },
    { label: '5월', value: 88, color: 'rgb(59 130 246)' },
    { label: '6월', value: 95, color: 'rgb(96 165 250)' },
  ];
  const maxVal = Math.max(...mockData.map((d) => d.value));

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white overflow-hidden ${className}`}
      style={{ minHeight: height }}
    >
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Spotfire 연동 미설정 · 로컬 Mock
        </p>
        {message && (
          <p className="mt-1 text-sm text-slate-600">{message}</p>
        )}
      </div>
      <div className="p-6">
        <div className="flex items-end justify-between gap-2 h-64">
          {mockData.map((d) => (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="w-full rounded-t transition-all hover:opacity-90"
                style={{
                  height: `${(d.value / maxVal) * 100}%`,
                  minHeight: 8,
                  backgroundColor: d.color,
                }}
              />
              <span className="text-xs text-slate-500">{d.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          .env에 <strong>NEXT_PUBLIC_SPOTFIRE_SERVER_URL</strong>과 <strong>NEXT_PUBLIC_SPOTFIRE_ANALYSIS_PATH</strong>(또는 analysisPath prop)를 설정하면 실제 Spotfire 차트가 표시됩니다.
        </p>
      </div>
    </div>
  );
}

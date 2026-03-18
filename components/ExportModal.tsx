'use client';

import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { authHeader, exportApiUrl } from '@/lib/api-client';

type ExportType = 'quality' | 'equipment';

export default function ExportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { language } = useLanguage();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;

  const [exportType, setExportType] = useState<ExportType>('quality');
  const [startDate, setStartDate] = useState(weekAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const [availableParams, setAvailableParams] = useState<string[]>([]);
  const [selectedParams, setSelectedParams] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && exportType === 'equipment') {
      fetch(exportApiUrl('/api/dashboard/export?type=equipment&listParams=1'), { headers: authHeader() })
        .then((r) => r.json())
        .then((json) => {
          if (json?.success && Array.isArray(json.params)) {
            setAvailableParams(json.params);
            setSelectedParams(new Set(json.params.slice(0, 6)));
          }
        })
        .catch(() => setAvailableParams([]));
    }
  }, [isOpen, exportType]);

  const toggleParam = (p: string) => {
    setSelectedParams((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('type', exportType);
      params.set('startDate', startDate);
      params.set('endDate', endDate);
      params.set('startTime', startTime);
      params.set('endTime', endTime);
      if (exportType === 'equipment' && selectedParams.size > 0) {
        params.set('params', [...selectedParams].join(','));
      }
      const res = await fetch(exportApiUrl(`/api/dashboard/export?${params.toString()}`), {
        headers: authHeader(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || res.statusText);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="?([^";]+)"?/);
      const filename = match ? match[1] : `export_${exportType}_${startDate}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            {language === 'ko' ? '데이터 다운로드 (CSV)' : 'Export Data (CSV)'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            aria-label={language === 'ko' ? '닫기' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {language === 'ko' ? '데이터 유형' : 'Data Type'}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExportType('quality')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  exportType === 'quality'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {language === 'ko' ? '품질' : 'Quality'}
              </button>
              <button
                type="button"
                onClick={() => setExportType('equipment')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  exportType === 'equipment'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {language === 'ko' ? '설비 모니터링' : 'Equipment Monitoring'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {language === 'ko' ? '시작 날짜' : 'Start Date'}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {language === 'ko' ? '종료 날짜' : 'End Date'}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {language === 'ko' ? '시작 시간' : 'Start Time'}
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {language === 'ko' ? '종료 시간' : 'End Time'}
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {exportType === 'equipment' && availableParams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {language === 'ko' ? '파라미터 선택' : 'Select Parameters'}
              </label>
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                {availableParams.map((p) => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedParams.has(p)}
                      onChange={() => toggleParam(p)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">{p}</span>
                  </label>
                ))}
              </div>
              {selectedParams.size === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {language === 'ko' ? '최소 1개 이상 선택해 주세요. 미선택 시 기본 파라미터가 사용됩니다.' : 'Select at least 1. Default params used if none selected.'}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleDownload}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            {loading ? (language === 'ko' ? '다운로드 중...' : 'Downloading...') : (language === 'ko' ? 'CSV 다운로드' : 'Download CSV')}
          </button>
        </div>
      </div>
    </div>
  );
}

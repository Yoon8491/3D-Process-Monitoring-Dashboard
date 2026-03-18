'use client';

import { useEffect, useState } from 'react';
import { Newspaper } from 'lucide-react';
import { dashboardApiUrl, authHeader } from '@/lib/api-client';
import ScrollbarOnScrollArea from '@/components/ScrollbarOnScrollArea';

const NAVER_NEWS_SEARCH_URL = 'https://search.naver.com/search.naver?where=news&query=엘앤에프';

type NewsItem = {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  originallink?: string;
};

/** 네이버 제목에서 `<b>`, `</b>` 등 HTML 태그 제거 (정규식) */
function stripHtml(html: string): string {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/** pubDate를 '2024.02.10 14:30' 형식으로 포맷 (날짜 + 시간) */
function formatPubDate(pubDate: string): string {
  if (!pubDate) return '';
  try {
    const d = new Date(pubDate);
    if (Number.isNaN(d.getTime())) return pubDate;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${day} ${h}:${min}`;
  } catch {
    return pubDate;
  }
}

export default function IRNewsSection() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(dashboardApiUrl('/api/news'), { cache: 'no-store', headers: authHeader() })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.items) ? data.items : [];
        setItems(list);
        if (list.length === 0 && data?.error) setError(data.error);
      })
      .catch(() => {
        if (!cancelled) {
          setError('뉴스를 불러올 수 없습니다.');
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col" aria-label="엘앤에프 관련 최신 뉴스">
      {/* 헤더: 커뮤니티와 동일 - 흰 배경, 초록 아이콘 */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <Newspaper className="w-4 h-4 text-emerald-600" />
          <h2 className="text-base font-semibold text-slate-900">L&amp;F 실시간 IR 뉴스</h2>
        </div>
      </div>
      {/* 리스트: 고정 높이 + 내부 스크롤만 */}
      <ScrollbarOnScrollArea className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500 mr-2" />
            로딩 중...
          </div>
        ) : error ? (
          <div className="py-4 text-center">
            <p className="text-slate-500 text-sm mb-3">{error}</p>
            <a
              href={NAVER_NEWS_SEARCH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              엘앤에프 관련 최신 뉴스 보기
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        ) : items.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-slate-500 text-sm mb-3">표시할 기사가 없습니다.</p>
            <a
              href={NAVER_NEWS_SEARCH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              엘앤에프 관련 최신 뉴스 보기
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        ) : (
          items.map((item, index) => (
            <a
              key={`${item.link}-${index}`}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="p-2 rounded border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <p className="text-xs font-medium text-slate-900 flex-1 min-w-0 line-clamp-2">
                    {stripHtml(item.title)}
                  </p>
                  {item.pubDate && (
                    <span className="text-[10px] text-slate-500 shrink-0 ml-1">
                      {formatPubDate(item.pubDate)}
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))
        )}
      </ScrollbarOnScrollArea>
    </div>
  );
}

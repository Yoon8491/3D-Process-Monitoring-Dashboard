'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, MessageSquare, Bot, X, Send, Plus, Edit2, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRightSidebar, RIGHT_SIDEBAR_WIDTH_MIN, RIGHT_SIDEBAR_WIDTH_MAX } from '@/contexts/RightSidebarContext';
import { useToast } from '@/contexts/ToastContext';
import { apiUrl, authHeader, dashboardApiUrl } from '@/lib/api-client';
import NoticeEditModal from './NoticeEditModal';
import CommunicationEditModal from './CommunicationEditModal';
import IRNewsSection from './IRNewsSection';
import ConfirmDialog from './ConfirmDialog';
import ScrollbarOnScrollArea from './ScrollbarOnScrollArea';

interface Notice {
  id?: number;
  title: string;
  date: string;
  important: boolean;
  content: string;
  author?: string;
}

interface Communication {
  id?: number;
  user: string;
  message: string;
  time: string;
  content: string;
  likes_count?: number;
  dislikes_count?: number;
  myVote?: 'like' | 'dislike' | null;
  replies?: Array<{
    id?: number;
    user: string;
    message: string;
    time: string;
    likes_count?: number;
    dislikes_count?: number;
    myVote?: 'like' | 'dislike' | null;
  }>;
}

export default function RightSidebar() {
  const { isAdmin, user } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const { rightSidebarOpen, rightSidebarWidth, setRightSidebarWidth } = useRightSidebar();
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // 오른쪽 사이드바 너비 드래그 리사이즈
  useEffect(() => {
    if (!isResizing) return;
    const clamp = (w: number) => Math.max(RIGHT_SIDEBAR_WIDTH_MIN, Math.min(RIGHT_SIDEBAR_WIDTH_MAX, w));
    const onMove = (e: MouseEvent) => {
      const deltaX = resizeStartX.current - e.clientX;
      const next = clamp(resizeStartWidth.current + deltaX);
      setRightSidebarWidth(next);
    };
    const onUp = () => setIsResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, setRightSidebarWidth]);

  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  
  // 초기 메시지는 서버와 클라이언트에서 동일하게 설정 (Hydration 오류 방지)
  type ChartData = { title: string; data: Array<{ label: string; value: number; color?: string }> };
  const [messages, setMessages] = useState<Array<{ role: 'bot' | 'user'; text: string; chartData?: ChartData }>>(() => {
    // 서버 사이드에서는 항상 기본값 반환
    if (typeof window === 'undefined') {
      return [{ role: 'bot', text: '안녕하세요! 무엇을 도와드릴까요?' }];
    }
    // 클라이언트에서도 초기에는 기본값, useEffect에서 localStorage 로드
    return [{ role: 'bot', text: '안녕하세요! 무엇을 도와드릴까요?' }];
  });
  
  // 새로고침 시에도 대화 유지: localStorage에서 복원 (서버 조회 없음)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('chatbot_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load chat from localStorage:', e);
    }
    setMessages([{ role: 'bot', text: t('chatbot.greeting') }]);
  }, []); // 마운트 시 한 번만

  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [selectedCommunication, setSelectedCommunication] = useState<Communication | null>(null);
  const [isNoticeEditModalOpen, setIsNoticeEditModalOpen] = useState(false);
  const [isCommunicationEditModalOpen, setIsCommunicationEditModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [editingNoticeIndex, setEditingNoticeIndex] = useState<number | null>(null);
  const [editingCommunication, setEditingCommunication] = useState<Communication | null>(null);
  const [editingCommunicationIndex, setEditingCommunicationIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // 댓글 수정 상태: [글 인덱스, 댓글 인덱스] 또는 null
  const [editingReplyAt, setEditingReplyAt] = useState<[number, number] | null>(null);
  const [editingReplyMessage, setEditingReplyMessage] = useState('');
  const [votingReplyId, setVotingReplyId] = useState<number | null>(null);
  const [votingCommId, setVotingCommId] = useState<number | null>(null);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [deleteReplyConfirm, setDeleteReplyConfirm] = useState<{ isOpen: boolean; replyId: number | null }>({
    isOpen: false,
    replyId: null,
  });
  const [deleteNoticeConfirm, setDeleteNoticeConfirm] = useState<{ isOpen: boolean; noticeId: number | null }>({
    isOpen: false,
    noticeId: null,
  });
  const [deleteCommunicationConfirm, setDeleteCommunicationConfirm] = useState<{ isOpen: boolean; commId: number | null }>({
    isOpen: false,
    commId: null,
  });

  const [notices, setNotices] = useState<Notice[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);

  const handleReplyVote = async (replyId: number, action: 'like' | 'dislike') => {
    if (votingReplyId !== null) return;
    const commId = selectedCommunication?.id;
    if (commId == null) return;
    const reply = selectedCommunication?.replies?.find((r) => r.id === replyId);
    if (!reply) return;

    const prevLikes = reply.likes_count ?? 0;
    const prevDislikes = reply.dislikes_count ?? 0;
    const prevMyVote = reply.myVote ?? null;

    setVotingReplyId(replyId);

    try {
      const response = await fetch(`/api/communications/replies/${replyId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ action }),
      });
      let data: { success?: boolean; likes_count?: number; dislikes_count?: number; myVote?: string | null; error?: string } = {};
      try {
        data = await response.json();
      } catch {
        data = { success: false, error: '연결 실패' };
      }
      if (data.success && data.likes_count !== undefined && data.dislikes_count !== undefined) {
        setSelectedCommunication((p) => {
          if (!p?.replies) return p;
          return {
            ...p,
            replies: p.replies.map((r) =>
              r.id === replyId ? { ...r, likes_count: data.likes_count, dislikes_count: data.dislikes_count, myVote: data.myVote ?? null } : r
            ),
          };
        });
        setCommunications((p) =>
          p.map((c) =>
            c.id === commId && c.replies
              ? {
                  ...c,
                  replies: c.replies.map((r) =>
                    r.id === replyId ? { ...r, likes_count: data.likes_count, dislikes_count: data.dislikes_count, myVote: data.myVote ?? null } : r
                  ),
                }
              : c
          )
        );
      } else {
        setSelectedCommunication((p) => {
          if (!p?.replies) return p;
          return {
            ...p,
            replies: p.replies.map((r) =>
              r.id === replyId ? { ...r, likes_count: prevLikes, dislikes_count: prevDislikes, myVote: prevMyVote } : r
            ),
          };
        });
        setCommunications((p) =>
          p.map((c) =>
            c.id === commId && c.replies
              ? { ...c, replies: c.replies!.map((r) => (r.id === replyId ? { ...r, likes_count: prevLikes, dislikes_count: prevDislikes, myVote: prevMyVote } : r)) }
              : c
          )
        );
        showToast('error', data?.error || '반영에 실패했습니다.');
      }
    } catch (e) {
      console.error('Vote error:', e);
      setSelectedCommunication((p) => {
        if (!p?.replies) return p;
        return {
          ...p,
          replies: p.replies.map((r) =>
            r.id === replyId ? { ...r, likes_count: prevLikes, dislikes_count: prevDislikes, myVote: prevMyVote } : r
          ),
        };
      });
      setCommunications((p) =>
        p.map((c) =>
          c.id === commId && c.replies
            ? { ...c, replies: c.replies!.map((r) => (r.id === replyId ? { ...r, likes_count: prevLikes, dislikes_count: prevDislikes, myVote: prevMyVote } : r)) }
            : c
        )
      );
      showToast('error', '연결 실패');
    } finally {
      setVotingReplyId(null);
    }
  };

  const handleCommunicationVote = async (commId: number, action: 'like' | 'dislike') => {
    if (votingCommId !== null) return;
    if (!selectedCommunication || selectedCommunication.id !== commId) return;

    const prevLikes = selectedCommunication.likes_count ?? 0;
    const prevDislikes = selectedCommunication.dislikes_count ?? 0;
    const prevMyVote = selectedCommunication.myVote ?? null;

    setVotingCommId(commId);

    try {
      const response = await fetch(`/api/communications/${commId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ action }),
      });
      let data: { success?: boolean; likes_count?: number; dislikes_count?: number; myVote?: string | null; error?: string } = {};
      try {
        data = await response.json();
      } catch {
        data = { success: false, error: '연결 실패' };
      }
      if (data.success && data.likes_count !== undefined && data.dislikes_count !== undefined) {
        // selectedCommunication 업데이트
        setSelectedCommunication((p) => {
          if (!p || p.id !== commId) return p;
          return {
            ...p,
            likes_count: data.likes_count,
            dislikes_count: data.dislikes_count,
            myVote: data.myVote ?? null,
          };
        });
        // communications 리스트도 업데이트
        setCommunications((p) =>
          p.map((c) =>
            c.id === commId
              ? { ...c, likes_count: data.likes_count, dislikes_count: data.dislikes_count, myVote: data.myVote ?? null }
              : c
          )
        );
      } else {
        showToast('error', data?.error || '반영에 실패했습니다.');
      }
    } catch (e) {
      console.error('Vote error:', e);
      showToast('error', '연결 실패');
    } finally {
      setVotingCommId(null);
    }
  };

  // 공지사항 로드
  useEffect(() => {
    const loadNotices = async () => {
      try {
        const response = await fetch('/api/notices', {
          headers: authHeader(),
        });
        const data = await response.json();
        if (data.success && data.notices) {
          setNotices(data.notices);
        }
      } catch (error) {
        console.error('공지사항 로드 오류:', error);
      }
    };
    loadNotices();
  }, []);

  // 커뮤니티 로드
  useEffect(() => {
    const loadCommunications = async () => {
      try {
        const response = await fetch('/api/communications', {
          headers: authHeader(),
        });
        const data = await response.json();
        console.log('커뮤니티 API 응답:', { success: data.success, count: data.communications?.length, error: data.error });
        if (data.success && data.communications) {
          console.log('커뮤니티 데이터:', data.communications);
          setCommunications(data.communications);
        } else {
          console.error('커뮤니티 로드 실패:', data.error || '알 수 없는 오류');
          // 실패해도 빈 배열로 설정하여 UI가 깨지지 않도록
          setCommunications([]);
        }
      } catch (error) {
        console.error('커뮤니티 로드 오류:', error);
        // 에러 발생 시에도 빈 배열로 설정
        setCommunications([]);
      }
    };
    loadCommunications();
  }, []);

  const botReply = useMemo(() => {
    return (text: string) => {
      const t = text.trim();
      if (!t) return '메시지를 입력해 주세요.';
      if (t.includes('설비')) return '설비 관련 이슈를 확인했습니다. 해당 설비/라인명을 알려주시면 더 정확히 안내드릴게요.';
      if (t.includes('경고') || t.includes('알람')) return '경고/알람 기준을 확인하고 싶으신가요? 발생 시간과 라인을 알려주세요.';
      if (t.includes('생산') || t.includes('생산량')) return '생산량은 대시보드의 “생산량” 카드에서 확인할 수 있어요. 기간(오늘/주간/월간)을 말씀해주시면 요약해드릴게요.';
      return `확인했습니다: ${t}`;
    };
  }, []);

  // 새로고침 시 유지를 위해 대화 내용 항상 localStorage에 저장
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('chatbot_messages', JSON.stringify(messages));
    } catch (e) {
      console.error('Failed to save messages to localStorage:', e);
    }
  }, [messages]);

  // 로그아웃 시에만 대화 초기화 (최초 로드 시 user가 아직 null인 경우는 건드리지 않음)
  const prevUserRef = useRef(user);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hadUser = prevUserRef.current != null;
    const hasUser = user != null;
    prevUserRef.current = user;
    if (hadUser && !hasUser) {
      localStorage.removeItem('chatbot_messages');
      setMessages([{ role: 'bot', text: t('chatbot.greeting') }]);
    }
  }, [user]);

  useEffect(() => {
    if (!isChatbotOpen) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [isChatbotOpen, messages.length]);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;
    
    // 사용자 메시지 추가
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setChatInput('');
    setIsLoading(true);

    try {
      // 대화 히스토리 준비 (최근 10개만, bot 메시지 제외)
      const recentHistory = messages
        .filter(msg => msg.role === 'user' || msg.role === 'bot')
        .slice(-10)
        .map(msg => ({
          role: msg.role,
          text: msg.text,
        })) as Array<{ role: 'user' | 'bot'; text: string }>;

      // RAG 및 컨텍스트는 사용자가 명시적으로 요청할 때만 포함
      const shouldUseRAG = text.toLowerCase().includes('웹사이트') || 
                          text.toLowerCase().includes('문서') || 
                          text.toLowerCase().includes('참고') ||
                          text.toLowerCase().includes('website') ||
                          text.toLowerCase().includes('document');
      const shouldIncludeNotices = text.toLowerCase().includes('공지') || 
                                  text.toLowerCase().includes('notice');
      const shouldIncludeCommunications = text.toLowerCase().includes('커뮤니') || 
                                         text.toLowerCase().includes('소통') ||
                                         text.toLowerCase().includes('communication');

      // 대시보드/공정/LOT 관련 질문 여부: LOT ID 패턴 또는 키워드
      const lotIdMatch = text.match(/\b(LOT-\d{8}-\d+)\b/i) || text.match(/\b(LOT-\d+-\d+)\b/i);
      let extractedLotId = lotIdMatch ? lotIdMatch[1] : null;
      const dashboardKeywords = /공정|현황|불량|레포트|대시보드|LOT|품질|생산|합격|불합격|lot|defect|quality|production|dashboard/i;
      const isDashboardRelated = dashboardKeywords.test(text) || !!extractedLotId;

      let dashboardContext: Record<string, unknown> | null = null;
      let lotDefectReport: Record<string, unknown> | null = null;
      let isRecentDefectLotQuery = false;

      if (isDashboardRelated) {
        try {
          const contextRes = await fetch(
            dashboardApiUrl(`/api/dashboard/chat-context?q=${encodeURIComponent(text)}`)
          );
          if (contextRes.ok) {
            const ctx = await contextRes.json();
            dashboardContext = ctx.success ? ctx : null;
            if (ctx?.recentDefectLotId != null && !extractedLotId) {
              extractedLotId = String(ctx.recentDefectLotId);
              isRecentDefectLotQuery = true;
            }
            if (ctx?.recentDefectLotNoData && ctx?.recentDefectLotMessage && dashboardContext) {
              (dashboardContext as Record<string, unknown>).recentDefectLotMessage = ctx.recentDefectLotMessage;
            } else if (ctx?.recentDefectLotMessage && dashboardContext && isRecentDefectLotQuery) {
              (dashboardContext as Record<string, unknown>).recentDefectLotMessage = ctx.recentDefectLotMessage;
            }
          }
        } catch (e) {
          console.warn('Chat: dashboard context fetch failed', e);
        }
      }

      if (extractedLotId) {
        try {
          const reportRes = await fetch(
            dashboardApiUrl(`/api/dashboard/lot-defect-report?lotId=${encodeURIComponent(extractedLotId)}`),
            { headers: { 'Content-Type': 'application/json', ...authHeader() } }
          );
          if (reportRes.ok) {
            const reportData = await reportRes.json();
            lotDefectReport = reportData.success !== false ? reportData : null;
          }
        } catch (e) {
          console.warn('Chat: lot-defect-report fetch failed', e);
        }
      }

      const payload = {
        message: text,
        conversationHistory: recentHistory,
        enableRAG: shouldUseRAG,
        includeNotices: shouldIncludeNotices,
        includeCommunications: shouldIncludeCommunications,
        notices: shouldIncludeNotices ? notices : [],
        communications: shouldIncludeCommunications ? communications : [],
        dashboardContext: dashboardContext ?? undefined,
        lotDefectReport: lotDefectReport ?? undefined,
        lotId: extractedLotId ?? undefined,
        isRecentDefectLotQuery: isRecentDefectLotQuery || undefined,
        stream: true,
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get('Content-Type') || '';
      const isStream = response.ok && contentType.includes('text/event-stream') && response.body;

      if (isStream) {
        setMessages((prev) => [...prev, { role: 'bot', text: '' }]);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';
            for (const part of parts) {
              if (part.startsWith('data: ')) {
                try {
                  const obj = JSON.parse(part.slice(6));
                  if (typeof obj.content === 'string') {
                    setMessages((prev) => {
                      const next = [...prev];
                      const last = next[next.length - 1];
                      if (last?.role === 'bot') next[next.length - 1] = { ...last, text: last.text + obj.content };
                      return next;
                    });
                  }
                  if (obj.chart && obj.chart.title && Array.isArray(obj.chart.data)) {
                    console.log('[Chatbot] Received chart SSE:', { title: obj.chart.title, dataLen: obj.chart.data.length });
                    setMessages((prev) => {
                      const next = [...prev];
                      const last = next[next.length - 1];
                      if (last?.role === 'bot') next[next.length - 1] = { ...last, chartData: obj.chart as ChartData };
                      return next;
                    });
                    setTimeout(scrollToBottom, 100);
                  }
                  if (obj.error) {
                    setMessages((prev) => {
                      const next = [...prev];
                      if (next[next.length - 1]?.role === 'bot') next[next.length - 1] = { ...next[next.length - 1], text: obj.error };
                      return next;
                    });
                  }
                } catch (_) { /* ignore parse error */ }
              }
            }
          }
          if (buffer.startsWith('data: ')) {
            try {
              const obj = JSON.parse(buffer.slice(6));
              if (typeof obj.content === 'string') {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.role === 'bot') next[next.length - 1] = { ...last, text: last.text + obj.content };
                  return next;
                });
              }
              if (obj.chart && obj.chart.title && Array.isArray(obj.chart.data)) {
                console.log('[Chatbot] Received chart SSE (buffer):', { title: obj.chart.title, dataLen: obj.chart.data.length });
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.role === 'bot') next[next.length - 1] = { ...last, chartData: obj.chart as ChartData };
                  return next;
                });
                setTimeout(scrollToBottom, 100);
              }
            } catch (_) {}
          }
        } finally {
          reader.releaseLock();
        }
        return;
      }

      let data: { success?: boolean; message?: string; error?: string };
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse response JSON:', jsonError);
        throw new Error(`서버 응답을 파싱할 수 없습니다. (${response.status})`);
      }

      if (response.ok && data.success) {
        setMessages((prev) => [...prev, { role: 'bot', text: data.message ?? '' }]);
      } else {
        setMessages((prev) => [...prev, {
          role: 'bot',
          text: data.error || `챗봇 요청 실패 (${response.status}: ${response.statusText})`,
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error details:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      setMessages((prev) => [...prev, { 
        role: 'bot', 
        text: errorMessage.includes('백엔드 서버') || errorMessage.includes('연결')
          ? errorMessage 
          : t('chatbot.error') + (process.env.NODE_ENV === 'development' ? ` (${errorMessage})` : '')
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
        id="right_side_bar"
        className={`fixed right-0 top-16 h-[calc(100vh-4rem)] bg-white border-l border-slate-200 flex flex-col overflow-hidden z-30 will-change-transform transition-transform duration-200 ease-out ${
          rightSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: rightSidebarOpen ? rightSidebarWidth : 0 }}
        role="complementary"
        aria-label="공지사항, 커뮤니티, L&amp;F 실시간 IR 뉴스"
      >
      {/* 리사이즈: 경계선에 마우스 올리면 커서 변경, 드래그로 너비 조절 (보이는 바 없음) */}
      {rightSidebarOpen && (
        <div
          role="separator"
          aria-label={language === 'ko' ? '사이드바 너비 조절' : 'Resize sidebar'}
          onMouseDown={(e) => {
            e.preventDefault();
            resizeStartX.current = e.clientX;
            resizeStartWidth.current = rightSidebarWidth;
            setIsResizing(true);
          }}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-[60] shrink-0"
          title={language === 'ko' ? '경계선을 드래그하여 너비 조절' : 'Drag to resize'}
        />
      )}
      {/* 공지사항 + 커뮤니티: 세로 공간 꽉 채움 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden pl-2">
      {/* 공지사항 - 남는 공간의 절반 채움 */}
      <div className="flex-1 min-h-0 flex flex-col p-3 border-b border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">{t('notice.title')}</h2>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setEditingNotice(null);
                setEditingNoticeIndex(null);
                setSelectedNotice(null);
                setSelectedCommunication(null);
                setIsChatbotOpen(false);
                setIsNoticeEditModalOpen(true);
              }}
              className="p-1 rounded hover:bg-slate-100 text-blue-600"
              title={t('notice.add')}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <ScrollbarOnScrollArea className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
          {notices.map((notice) => (
            <div
              key={notice.id || `notice-${notice.title}`}
              className="p-2 rounded border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-1">
                <div
                  className="flex-1 cursor-pointer min-w-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCommunication(null);
                    setIsChatbotOpen(false);
                    setIsNoticeEditModalOpen(false);
                    setSelectedNotice(notice);
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    {notice.important && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-700 rounded shrink-0">
                        {t('notice.important')}
                      </span>
                    )}
                    <span className="text-xs font-medium text-slate-900 truncate">{notice.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{notice.date}</span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const idx = notices.findIndex((n) => n.id === notice.id);
                        setEditingNotice(notice);
                        setEditingNoticeIndex(idx);
                        setIsNoticeEditModalOpen(true);
                      }}
                      className="p-1 rounded hover:bg-blue-50 text-blue-600"
                      title={t('notice.edit')}
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const noticeId = notice.id;
                        if (noticeId) {
                          setDeleteNoticeConfirm({ isOpen: true, noticeId });
                        }
                      }}
                      className="p-1 rounded hover:bg-red-50 text-red-600"
                      title={t('notice.delete')}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </ScrollbarOnScrollArea>
      </div>

      {/* 커뮤니티 - 남는 공간의 절반 채움 */}
      <div className="flex-1 min-h-0 flex flex-col p-3 border-b border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-900">{t('community.title')}</h2>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => {
                setEditingCommunication(null);
                setEditingCommunicationIndex(null);
                setSelectedNotice(null);
                setSelectedCommunication(null);
                setIsChatbotOpen(false);
                setIsNoticeEditModalOpen(false);
                setIsCommunicationEditModalOpen(true);
              }}
              className="p-1 rounded hover:bg-slate-100 text-emerald-600"
              title="글 작성"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <ScrollbarOnScrollArea className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
          {communications.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-500">
              커뮤니티 글이 없습니다.
            </div>
          ) : (
            communications.map((chat) => (
              <div
                key={chat.id || `comm-${chat.user}-${chat.time}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNotice(null);
                  setIsChatbotOpen(false);
                  setIsNoticeEditModalOpen(false);
                  setSelectedCommunication(chat);
                }}
                className="p-2 rounded border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <p className="text-xs font-medium text-slate-900 flex-1 min-w-0 truncate">{chat.message}</p>
                  <span className="text-[10px] text-slate-500 shrink-0 ml-1">{chat.time}</span>
                </div>
                <span className="text-[10px] text-slate-500">{chat.user}</span>
              </div>
            ))
          )}
        </ScrollbarOnScrollArea>
      </div>

      {/* L&F 실시간 IR 뉴스 */}
      <div className="flex-1 min-h-0 flex flex-col p-3 border-b border-slate-200 overflow-hidden">
        <IRNewsSection />
      </div>
      </div>

      {/* 챗봇 버튼: 하단 고정 (환경 변수로 제어 가능, 기본값: 표시) */}
      {(process.env.NEXT_PUBLIC_ENABLE_CHATBOT !== 'false') && (
        <div className="p-3 border-t border-slate-200 bg-white shrink-0">
          <button
            type="button"
            className="w-full inline-flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            onClick={() => {
              setSelectedNotice(null);
              setSelectedCommunication(null);
              setIsNoticeEditModalOpen(false);
              setIsChatbotOpen(true);
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-600" />
              {t('chatbot.open')}
            </span>
          </button>
        </div>
      )}

      {/* 공지사항 상세 팝업 */}
      {selectedNotice && (
        <div 
          className="absolute inset-0 z-50 bg-white flex flex-col"
          onClick={(e) => {
            // 배경 클릭 시 닫기 방지 (내부 클릭만 처리)
            e.stopPropagation();
          }}
        >
          <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-slate-900">{t('notice.title')}</span>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <button
                    type="button"
                    className="rounded-lg p-2 hover:bg-slate-100 text-blue-600"
                    onClick={() => {
                      const index = notices.findIndex((n) => n.id === selectedNotice.id);
                      setEditingNotice(selectedNotice);
                      setEditingNoticeIndex(index);
                      setSelectedNotice(null);
                      setIsChatbotOpen(false);
                      setIsNoticeEditModalOpen(true);
                    }}
                    aria-label={t('notice.edit')}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 hover:bg-slate-100 text-red-600"
                    onClick={() => {
                      const noticeId = selectedNotice.id;
                      if (noticeId) {
                        setDeleteNoticeConfirm({ isOpen: true, noticeId });
                      }
                    }}
                    aria-label={t('notice.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                className="rounded-lg p-2 hover:bg-slate-100"
                onClick={() => setSelectedNotice(null)}
                aria-label="닫기"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
          </div>
          <ScrollbarOnScrollArea className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                {selectedNotice.important && (
                  <span className="text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded">
                    {t('notice.important')}
                  </span>
                )}
                <h3 className="text-xl font-bold text-slate-900">{selectedNotice.title}</h3>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span>{selectedNotice.date}</span>
                {selectedNotice.author && <span>{t('notice.author')}: {selectedNotice.author}</span>}
              </div>
            </div>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-line text-slate-700 leading-relaxed">
                {selectedNotice.content}
              </div>
            </div>
          </ScrollbarOnScrollArea>
        </div>
      )}

      {/* 커뮤니티 상세 팝업 */}
      {selectedCommunication && (
        <div 
          className="absolute inset-0 z-50 bg-white flex flex-col"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
              <span className="font-semibold text-slate-900">{t('community.title')}</span>
            </div>
            <div className="flex items-center gap-2">
              {user && (selectedCommunication.user === user.name || selectedCommunication.user === user.employeeNumber) && (
                <>
                  <button
                    type="button"
                    className="rounded-lg p-2 hover:bg-slate-100 text-emerald-600"
                    onClick={() => {
                      const index = communications.findIndex((c) => c.id === selectedCommunication.id);
                      setEditingCommunication(selectedCommunication);
                      setEditingCommunicationIndex(index);
                      setSelectedCommunication(null);
                      setIsChatbotOpen(false);
                      setIsNoticeEditModalOpen(false);
                      setIsCommunicationEditModalOpen(true);
                    }}
                    aria-label="수정"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 hover:bg-slate-100 text-red-600"
                    onClick={() => {
                      const commId = selectedCommunication.id;
                      if (commId) {
                        setDeleteCommunicationConfirm({ isOpen: true, commId });
                      }
                    }}
                    aria-label="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                className="rounded-lg p-2 hover:bg-slate-100"
                onClick={() => setSelectedCommunication(null)}
                aria-label="닫기"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
          </div>
          <ScrollbarOnScrollArea className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedCommunication.user}</h3>
                  <span className="text-sm text-slate-500">{selectedCommunication.time}</span>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm font-medium text-slate-900 mb-2">{selectedCommunication.message}</p>
                <div className="whitespace-pre-line text-slate-700 text-sm leading-relaxed">
                  {selectedCommunication.content}
                </div>
                {/* 좋아요/싫어요 버튼 */}
                <div className="flex items-center justify-end gap-3 mt-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      const commId = selectedCommunication.id;
                      if (commId) {
                        handleCommunicationVote(commId, 'like');
                      }
                    }}
                    disabled={votingCommId === selectedCommunication.id}
                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                      selectedCommunication.myVote === 'like'
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-slate-500/80 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                    aria-label="좋아요"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    <span className="text-xs tabular-nums">{selectedCommunication.likes_count ?? 0}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const commId = selectedCommunication.id;
                      if (commId) {
                        handleCommunicationVote(commId, 'dislike');
                      }
                    }}
                    disabled={votingCommId === selectedCommunication.id}
                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                      selectedCommunication.myVote === 'dislike'
                        ? 'text-red-600 bg-red-50'
                        : 'text-slate-500/80 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                    aria-label="싫어요"
                  >
                    <ThumbsDown className="h-4 w-4" />
                    <span className="text-xs tabular-nums">{selectedCommunication.dislikes_count ?? 0}</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <h4 className="text-md font-semibold text-slate-900 mb-4">
                {t('community.replies')} ({selectedCommunication.replies?.length || 0})
              </h4>
              
              {selectedCommunication.replies && selectedCommunication.replies.length > 0 && (
                <div className="space-y-4 mb-6">
                  {selectedCommunication.replies.map((reply, replyIndex) => {
                    const commIndex = communications.findIndex((c) => c.id === selectedCommunication.id);
                    const isMyReply = user && (reply.user === user.name || reply.user === user.employeeNumber);
                    const isEditingThis = editingReplyAt && editingReplyAt[0] === commIndex && editingReplyAt[1] === replyIndex;

                    return (
                      <div key={replyIndex} className="p-4 bg-white rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-900">{reply.user}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">{reply.time}</span>
                            {isMyReply && !isEditingThis && (
                              <>
                                <button
                                  type="button"
                                  className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600"
                                  onClick={() => {
                                    setEditingReplyAt([commIndex, replyIndex]);
                                    setEditingReplyMessage(reply.message);
                                  }}
                                  aria-label={t('community.editReply')}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="p-1.5 rounded hover:bg-red-50 text-red-600"
                                  onClick={() => {
                                    const replyId = reply.id;
                                    if (!replyId) {
                                      alert('댓글 ID를 찾을 수 없습니다.');
                                      return;
                                    }
                                    setDeleteReplyConfirm({ isOpen: true, replyId });
                                  }}
                                  aria-label={t('community.deleteReply')}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {isEditingThis ? (
                          <div className="mt-2">
                            <input
                              type="text"
                              value={editingReplyMessage}
                              onChange={(e) => setEditingReplyMessage(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-emerald-500 mb-2"
                              placeholder={t('community.replyPlaceholder')}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                  onClick={async () => {
                                    if (!editingReplyMessage.trim()) {
                                      alert(t('community.replyRequired'));
                                      return;
                                    }
                                    const replyId = reply.id;
                                    if (!replyId) {
                                      alert('댓글 ID를 찾을 수 없습니다.');
                                      return;
                                    }
                                    try {
                                      const response = await fetch(`/api/communications/replies/${replyId}`, {
                                        method: 'PUT',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          ...authHeader(),
                                        },
                                        body: JSON.stringify({
                                          message: editingReplyMessage.trim(),
                                        }),
                                      });
                                      const data = await response.json();
                                      if (data.success) {
                                        // 데이터 다시 로드
                                        const loadResponse = await fetch('/api/communications', { headers: authHeader() });
                                        const loadData = await loadResponse.json();
                                        if (loadData.success) {
                                          const commId = selectedCommunication.id;
                                          const updatedComm = loadData.communications.find((c: Communication) => c.id === commId);
                                          if (updatedComm) {
                                            setCommunications(loadData.communications);
                                            setSelectedCommunication(updatedComm);
                                          }
                                        }
                                        setEditingReplyAt(null);
                                        setEditingReplyMessage('');
                                      } else {
                                        alert(data.error || '댓글 수정에 실패했습니다.');
                                      }
                                    } catch (error) {
                                      console.error('댓글 수정 오류:', error);
                                      alert('댓글 수정 중 오류가 발생했습니다.');
                                    }
                                  }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
                              >
                                {t('community.save')}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingReplyAt(null);
                                  setEditingReplyMessage('');
                                }}
                                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium"
                              >
                                {t('community.cancel')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-700">{reply.message}</p>
                        )}
                        {reply.id != null && (
                          <div className="flex items-center justify-end gap-3 mt-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleReplyVote(reply.id!, 'like')}
                              disabled={votingReplyId === reply.id}
                              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                reply.myVote === 'like'
                                  ? 'text-blue-600 bg-blue-50'
                                  : 'text-slate-500/80 hover:text-slate-700 hover:bg-slate-100'
                              }`}
                              aria-label="좋아요"
                            >
                              <ThumbsUp className="h-4 w-4" />
                              <span className="text-xs tabular-nums">{reply.likes_count ?? 0}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReplyVote(reply.id!, 'dislike')}
                              disabled={votingReplyId === reply.id}
                              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                reply.myVote === 'dislike'
                                  ? 'text-red-600 bg-red-50'
                                  : 'text-slate-500/80 hover:text-slate-700 hover:bg-slate-100'
                              }`}
                              aria-label="싫어요"
                            >
                              <ThumbsDown className="h-4 w-4" />
                              <span className="text-xs tabular-nums">{reply.dislikes_count ?? 0}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </ScrollbarOnScrollArea>
          {/* 댓글 입력 폼: 하단 고정 */}
          <div className="shrink-0 border-t border-slate-200 bg-white p-6">
            {user ? (
              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium text-slate-900">{t('community.writeReply') || '댓글 작성'}</span>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    
                    // 이미 제출 중이면 무시
                    if (isSubmittingReply) {
                      return;
                    }

                    const replyInput = e.currentTarget.querySelector('input[type="text"]') as HTMLInputElement;
                    const replyText = replyInput?.value.trim();
                    
                    if (!replyText) {
                      alert(language === 'ko' ? '댓글을 입력해주세요.' : 'Please enter a reply.');
                      return;
                    }

                    const commId = selectedCommunication.id;
                    if (!commId) {
                      alert('글 ID를 찾을 수 없습니다.');
                      return;
                    }

                    setIsSubmittingReply(true);
                    try {
                      const response = await fetch(`/api/communications/${commId}/replies`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...authHeader(),
                        },
                        body: JSON.stringify({
                          user: user.name || user.employeeNumber,
                          message: replyText,
                        }),
                      });
                      const data = await response.json();
                      if (data.success) {
                        // 데이터 다시 로드
                        const loadResponse = await fetch('/api/communications', { headers: authHeader() });
                        const loadData = await loadResponse.json();
                        if (loadData.success) {
                          const updatedComm = loadData.communications.find((c: Communication) => c.id === commId);
                          if (updatedComm) {
                            setCommunications(loadData.communications);
                            setSelectedCommunication(updatedComm);
                          }
                        }
                        replyInput.value = '';
                      } else {
                        alert(data.error || '댓글 작성에 실패했습니다.');
                      }
                    } catch (error) {
                      console.error('댓글 작성 오류:', error);
                      alert('댓글 작성 중 오류가 발생했습니다.');
                    } finally {
                      setIsSubmittingReply(false);
                    }
                  }}
                  className="flex gap-2 items-center"
                >
                  <input
                    type="text"
                    placeholder={t('community.replyPlaceholder') || '댓글을 입력하세요...'}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingReply}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap flex-shrink-0 flex items-center gap-1 ${
                      isSubmittingReply
                        ? 'bg-slate-400 text-white cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <Send className="h-4 w-4" />
                    <span>{isSubmittingReply ? (t('community.submitting') || '등록 중...') : (t('community.submit') || '등록')}</span>
                  </button>
                </form>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-500 text-center py-2">
                  {t('community.loginToReply') || '댓글을 작성하려면 로그인이 필요합니다.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 챗봇 팝업(오른쪽 사이드바 내부): flex로 입력칸이 항상 보이게 */}
      <div
        className={`absolute inset-0 z-50 bg-white flex flex-col transition-transform duration-200 ${
          isChatbotOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
        aria-hidden={!isChatbotOpen}
      >
        <div className="shrink-0 h-14 px-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="h-5 w-5 text-purple-600 shrink-0" />
            <span className="font-semibold text-slate-900 truncate">{language === 'ko' ? '챗봇' : 'Chatbot'}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-slate-100"
              onClick={() => setIsChatbotOpen(false)}
              aria-label={t('chatbot.close')}
            >
              <X className="h-5 w-5 text-slate-600" />
            </button>
          </div>
        </div>

        <ScrollbarOnScrollArea ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {m.text ? (
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm border whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-900 border-slate-200'
                  }`}
                >
                  {m.text}
                </div>
              ) : null}
              {m.role === 'bot' && m.chartData && m.chartData.data?.length > 0 && (
                <div className="w-full max-w-[85%] min-w-[240px] bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">{m.chartData.title}</h4>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={m.chartData.data} margin={{ bottom: 40, left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="label"
                        angle={0}
                        textAnchor="middle"
                        height={52}
                        interval={0}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={32} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value: number) => [`${value}%`, '영향도']} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {m.chartData.data.map((entry, i) => (
                          <Cell key={i} fill={entry.color || '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm border bg-white text-slate-900 border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
        </ScrollbarOnScrollArea>

        <div className="shrink-0 min-w-0 px-4 py-3 border-t border-slate-200 bg-white flex items-center gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLoading) sendChat();
            }}
            type="text"
            placeholder={t('chatbot.placeholder')}
            disabled={isLoading}
            className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            className="shrink-0 inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
            onClick={sendChat}
            disabled={isLoading}
            aria-label={t('chatbot.send')}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* 공지사항 작성/수정 모달 */}
      {isNoticeEditModalOpen && (
        <NoticeEditModal
          notice={editingNotice}
          onClose={() => {
            setIsNoticeEditModalOpen(false);
            setEditingNotice(null);
            setEditingNoticeIndex(null);
            setSelectedNotice(null);
            setSelectedCommunication(null);
            setIsChatbotOpen(false);
          }}
          onSave={async (notice) => {
            try {
              const editId = notice.id ?? editingNotice?.id;
              if (editingNoticeIndex !== null && editId != null) {
                // 수정: 기존 글 업데이트(PUT), 새 글이 생기지 않음
                const response = await fetch(`/api/notices/${editId}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    ...authHeader(),
                  },
                  body: JSON.stringify({
                    title: notice.title,
                    content: notice.content,
                    important: notice.important,
                    author: notice.author,
                  }),
                });
                const data = await response.json();
                if (data.success) {
                  const loadResponse = await fetch('/api/notices', { headers: authHeader() });
                  const loadData = await loadResponse.json();
                  if (loadData.success) {
                    setNotices(loadData.notices);
                  }
                } else {
                  alert(data.error || '수정에 실패했습니다.');
                  return;
                }
              } else {
                // 새 글 작성(POST)
                const response = await fetch('/api/notices', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...authHeader(),
                  },
                  body: JSON.stringify({
                    title: notice.title,
                    content: notice.content,
                    important: notice.important,
                    author: notice.author,
                  }),
                });
                const data = await response.json();
                if (data.success) {
                  // 데이터 다시 로드
                  const loadResponse = await fetch('/api/notices', { headers: authHeader() });
                  const loadData = await loadResponse.json();
                  if (loadData.success) {
                    setNotices(loadData.notices);
                  }
                } else {
                  alert(data.error || '작성에 실패했습니다.');
                  return;
                }
              }
              setIsNoticeEditModalOpen(false);
              setEditingNotice(null);
              setEditingNoticeIndex(null);
              setSelectedNotice(null);
              setSelectedCommunication(null);
              setIsChatbotOpen(false);
            } catch (error) {
              console.error('공지사항 저장 오류:', error);
              alert('저장 중 오류가 발생했습니다.');
            }
          }}
        />
      )}

      {/* 커뮤니티 작성/수정 모달 */}
      {isCommunicationEditModalOpen && user && (
        <CommunicationEditModal
          communication={editingCommunication}
          currentUser={user.name || user.employeeNumber}
          onClose={() => {
            setIsCommunicationEditModalOpen(false);
            setEditingCommunication(null);
            setEditingCommunicationIndex(null);
            setSelectedNotice(null);
            setSelectedCommunication(null);
            setIsChatbotOpen(false);
            setIsNoticeEditModalOpen(false);
          }}
          onSave={async (communication) => {
            try {
              if (editingCommunication && editingCommunication.id) {
                // 수정
                const response = await fetch(`/api/communications/${editingCommunication.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    ...authHeader(),
                  },
                  body: JSON.stringify({
                    message: communication.message,
                    content: communication.content,
                  }),
                });
                const data = await response.json();
                if (data.success) {
                  // 데이터 다시 로드
                  const loadResponse = await fetch('/api/communications', { headers: authHeader() });
                  const loadData = await loadResponse.json();
                  if (loadData.success) {
                    setCommunications(loadData.communications);
                  }
                } else {
                  alert(data.error || '수정에 실패했습니다.');
                  return;
                }
              } else {
                // 추가
                const response = await fetch('/api/communications', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...authHeader(),
                  },
                  body: JSON.stringify({
                    user: communication.user,
                    message: communication.message,
                    content: communication.content,
                  }),
                });
                const data = await response.json();
                if (data.success) {
                  // 데이터 다시 로드
                  const loadResponse = await fetch('/api/communications', { headers: authHeader() });
                  const loadData = await loadResponse.json();
                  if (loadData.success) {
                    setCommunications(loadData.communications);
                  }
                } else {
                  alert(data.error || '작성에 실패했습니다.');
                  return;
                }
              }
              setIsCommunicationEditModalOpen(false);
              setEditingCommunication(null);
              setEditingCommunicationIndex(null);
              setSelectedNotice(null);
              setSelectedCommunication(null);
              setIsChatbotOpen(false);
              setIsNoticeEditModalOpen(false);
            } catch (error) {
              console.error('커뮤니티 글 저장 오류:', error);
              alert('저장 중 오류가 발생했습니다.');
            }
          }}
        />
      )}

      {/* 댓글 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={deleteReplyConfirm.isOpen}
        message={t('community.confirmDeleteReply')}
        confirmText="삭제"
        cancelText="취소"
        confirmButtonColor="red"
        onConfirm={async () => {
          const replyId = deleteReplyConfirm.replyId;
          if (!replyId) {
            setDeleteReplyConfirm({ isOpen: false, replyId: null });
            return;
          }
          try {
            const response = await fetch(`/api/communications/replies/${replyId}`, {
              method: 'DELETE',
              headers: authHeader(),
            });
            const data = await response.json();
            if (data.success) {
              // 데이터 다시 로드
              const loadResponse = await fetch('/api/communications', { headers: authHeader() });
              const loadData = await loadResponse.json();
              if (loadData.success) {
                const commId = selectedCommunication?.id;
                if (commId) {
                  const updatedComm = loadData.communications.find((c: Communication) => c.id === commId);
                  if (updatedComm) {
                    setCommunications(loadData.communications);
                    setSelectedCommunication(updatedComm);
                  }
                }
              }
              setEditingReplyAt(null);
              setEditingReplyMessage('');
              showToast('success', '댓글이 삭제되었습니다.');
            } else {
              showToast('error', data.error || '댓글 삭제에 실패했습니다.');
            }
          } catch (error) {
            console.error('댓글 삭제 오류:', error);
            showToast('error', '댓글 삭제 중 오류가 발생했습니다.');
          }
          setDeleteReplyConfirm({ isOpen: false, replyId: null });
        }}
        onCancel={() => {
          setDeleteReplyConfirm({ isOpen: false, replyId: null });
        }}
      />

      {/* 공지사항 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={deleteNoticeConfirm.isOpen}
        message={language === 'ko' ? '이 공지사항을 삭제하시겠습니까?' : 'Are you sure you want to delete this notice?'}
        confirmText="삭제"
        cancelText="취소"
        confirmButtonColor="red"
        onConfirm={async () => {
          const noticeId = deleteNoticeConfirm.noticeId;
          if (!noticeId) {
            setDeleteNoticeConfirm({ isOpen: false, noticeId: null });
            return;
          }
          try {
            const response = await fetch(`/api/notices/${noticeId}`, {
              method: 'DELETE',
              headers: authHeader(),
            });
            const data = await response.json();
            if (data.success) {
              const idx = notices.findIndex((n) => n.id === noticeId);
              if (idx !== -1) {
                setNotices(notices.filter((_, i) => i !== idx));
              }
              if (selectedNotice?.id === noticeId) {
                setSelectedNotice(null);
              }
              showToast('success', '공지사항이 삭제되었습니다.');
            } else {
              showToast('error', data.error || '삭제에 실패했습니다.');
            }
          } catch (error) {
            console.error('공지사항 삭제 오류:', error);
            showToast('error', '삭제 중 오류가 발생했습니다.');
          }
          setDeleteNoticeConfirm({ isOpen: false, noticeId: null });
        }}
        onCancel={() => {
          setDeleteNoticeConfirm({ isOpen: false, noticeId: null });
        }}
      />

      {/* 커뮤니티 글 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={deleteCommunicationConfirm.isOpen}
        message="이 글을 삭제하시겠습니까?"
        confirmText="삭제"
        cancelText="취소"
        confirmButtonColor="red"
        onConfirm={async () => {
          const commId = deleteCommunicationConfirm.commId;
          if (!commId) {
            setDeleteCommunicationConfirm({ isOpen: false, commId: null });
            return;
          }
          try {
            const response = await fetch(`/api/communications/${commId}`, {
              method: 'DELETE',
              headers: authHeader(),
            });
            const data = await response.json();
            if (data.success) {
              const idx = communications.findIndex((c) => c.id === commId);
              if (idx !== -1) {
                setCommunications(communications.filter((_, i) => i !== idx));
              }
              if (selectedCommunication?.id === commId) {
                setSelectedCommunication(null);
              }
              showToast('success', '글이 삭제되었습니다.');
            } else {
              showToast('error', data.error || '삭제에 실패했습니다.');
            }
          } catch (error) {
            console.error('커뮤니티 글 삭제 오류:', error);
            showToast('error', '삭제 중 오류가 발생했습니다.');
          }
          setDeleteCommunicationConfirm({ isOpen: false, commId: null });
        }}
        onCancel={() => {
          setDeleteCommunicationConfirm({ isOpen: false, commId: null });
        }}
      />
    </div>
  );
}

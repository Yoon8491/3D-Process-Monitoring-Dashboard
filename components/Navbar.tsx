'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogIn, LogOut, User, RefreshCw, PanelRight, Bell, Download } from 'lucide-react';
import LoginModal from './LoginModal';
import ExportModal from './ExportModal';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDashboardRefresh } from '@/contexts/DashboardRefreshContext';
import { useRightSidebar } from '@/contexts/RightSidebarContext';
import { useGrafanaAlerts } from '@/contexts/GrafanaAlertContext';
import { formatTimeSeoulWithSeconds } from '@/lib/date-format';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const { triggerRefresh } = useDashboardRefresh();
  const { rightSidebarOpen, toggleRightSidebar, alertsPanelOpen, setAlertsPanelOpen } = useRightSidebar();
  const { alerts } = useGrafanaAlerts();

  return (
    <div className="fixed top-0 left-0 right-0 h-16 z-20 shadow-md border-b border-[#252840]" style={{ background: 'linear-gradient(90deg, #1A1C2E 0%, #1B1C2F 50%, #1E1F35 100%)' }}>
      {/* 사이드바 위 공간까지 포함한 전체 너비 사용, 3구역으로 분산 (한 줄 고정) */}
      <div className="h-full w-full px-6 flex items-center gap-0">
        {/* 제일 왼쪽: AZAS 로고 + 서브타이틀 (클릭 시 메인 페이지) */}
        <Link
          href="/"
          className="shrink-0 flex flex-col justify-center pr-8 border-r border-white/10 hover:opacity-90 transition-opacity"
          aria-label={language === 'ko' ? '메인으로' : 'Go to main'}
        >
          <span className="text-lg font-bold text-white tracking-wide">AZAS</span>
          <span className="text-[10px] text-white/80 leading-tight">Active material Zero defect AI Solutions.</span>
        </Link>
        {/* 왼쪽 여백 (상태 아이템 제거됨) */}
        <div className="flex-1 min-w-0" />

        {/* 오른쪽 구역: 알람, 오른쪽 사이드바 토글, 마지막 업데이트, 새로고침, 사용자, 로그아웃, 시각 */}
        <div className="shrink-0 flex items-center justify-end gap-3 pl-4">
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={triggerRefresh}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors"
              title={language === 'ko' ? '새로고침' : 'Refresh'}
              aria-label={language === 'ko' ? '새로고침' : 'Refresh'}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            {user && (
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center justify-center w-10 h-10 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                title={language === 'ko' ? '데이터 다운로드 (CSV)' : 'Download data (CSV)'}
                aria-label={language === 'ko' ? '데이터 다운로드' : 'Download data'}
              >
                <Download className="w-5 h-5" />
              </button>
            )}
            {user && (
              <>
                <button
                  type="button"
                  onClick={() => setAlertsPanelOpen(!alertsPanelOpen)}
                  className="relative flex items-center justify-center w-10 h-10 rounded-lg text-white/90 hover:bg-white/10 transition-colors"
                  title={language === 'ko' ? '알람 내역' : 'Alert History'}
                  aria-label={language === 'ko' ? '알람 내역' : 'Alert History'}
                >
                  <Bell className="w-5 h-5" />
                  {alerts.filter(a => a.status === 'firing').length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white/20" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={toggleRightSidebar}
                  className="flex items-center justify-center w-10 h-10 rounded-lg text-white/90 hover:bg-white/10 transition-colors"
                  title={rightSidebarOpen ? (language === 'ko' ? '오른쪽 패널 닫기' : 'Close right panel') : (language === 'ko' ? '오른쪽 패널 열기' : 'Open right panel')}
                  aria-label={rightSidebarOpen ? (language === 'ko' ? '오른쪽 패널 닫기' : 'Close right panel') : (language === 'ko' ? '오른쪽 패널 열기' : 'Open right panel')}
                >
                  <PanelRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
          {user ? (
            <>
              <div className="flex items-center gap-2 text-sm text-blue-100 whitespace-nowrap">
                <User className="h-4 w-4 shrink-0" />
                <span className="text-white font-medium truncate max-w-[80px]">{user.name}</span>
                {user.role === 'admin' && (
                  <span className="px-2 py-0.5 bg-white/25 text-white rounded text-xs shrink-0">{t('admin')}</span>
                )}
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0"
              onClick={() => setIsLoginModalOpen(true)}
            >
              <LogIn className="h-4 w-4" />
              {t('nav.login')}
            </button>
          )}
          <div className="text-sm text-white/80 whitespace-nowrap shrink-0">
            {formatTimeSeoulWithSeconds(new Date())}
          </div>
        </div>
      </div>
      
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}

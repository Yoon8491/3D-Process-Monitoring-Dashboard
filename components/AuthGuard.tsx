'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useRightSidebar } from '@/contexts/RightSidebarContext';
import RightSidebar from '@/components/RightSidebar';
import AlertsSidebar from '@/components/AlertsSidebar';
import ScrollbarOnScrollArea from '@/components/ScrollbarOnScrollArea';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { rightSidebarOpen, rightSidebarWidth } = useRightSidebar();

  useEffect(() => {
    // 로딩 중이면 아무것도 하지 않음
    if (isLoading) return;

    // 로그인 페이지는 인증 체크 제외
    if (pathname === '/login') {
      // 이미 로그인되어 있으면 메인 페이지로 리다이렉트
      if (user) {
        router.push('/');
      }
      return;
    }

    // 로그인하지 않았으면 로그인 페이지로 리다이렉트
    if (!user) {
      router.push('/login');
    }
  }, [user, isLoading, pathname, router]);

  /* 메인 화면 스크롤바 트랙만: 로그인은 흰색, 그 외(공정 현황·설비 모니터링 등)는 메인 배경 slate-100 */
  useEffect(() => {
    const isLogin = pathname === '/login';
    document.documentElement.style.setProperty(
      '--scroll-track-bg',
      isLogin ? '#ffffff' : '#f1f5f9'
    );
    return () => {
      document.documentElement.style.setProperty('--scroll-track-bg', '#ffffff');
    };
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (pathname !== '/login' && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">로그인 페이지로 이동 중...</p>
        </div>
      </div>
    );
  }

  const showRightSidebar = pathname !== '/login' && user;

  if (showRightSidebar) {
    return (
      <div className="flex h-screen w-full bg-[var(--scroll-track-bg)]">
        <ScrollbarOnScrollArea
          className="main-content-scroll-area flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden"
        >
          {children}
        </ScrollbarOnScrollArea>
        <RightSidebar />
        <AlertsSidebar />
      </div>
    );
  }

  return (
    <>
      {children}
    </>
  );
}

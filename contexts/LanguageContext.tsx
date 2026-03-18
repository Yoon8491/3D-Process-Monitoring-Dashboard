'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'ko' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  ko: {
    // 공통
    'dashboard': '대시보드',
    'settings': '설정',
    'logout': '로그아웃',
    'login': '로그인',
    'name': '이름',
    'employeeNumber': '사원번호',
    'admin': '관리자',
    'employee': '사원',
    
    // 설정 페이지
    'settings.title': '설정',
    'settings.subtitle': '시스템 설정 관리',
    'settings.myInfo': '내 정보',
    'settings.general': '일반 설정',
    'settings.notifications': '알림 설정',
    'settings.security': '보안 설정',
    'settings.systemInfo': '시스템 정보',
    'settings.language': '언어 설정',
    'settings.korean': '한국어',
    'settings.english': 'English',
    'settings.systemName': '시스템 이름',
    'settings.updateName': '이름 변경',
    'settings.updating': '변경 중...',
    'settings.namePlaceholder': '이름을 입력하세요',
    'settings.nameRequired': '이름을 입력해주세요.',
    'settings.nameTooLong': '이름은 한글/기타 최대 5글자, 영어(공백 포함) 최대 10글자까지 가능합니다.',
    'settings.nameMax5': '글자 수 최대 5글자까지 가능합니다.',
    'settings.nameMax10': '글자 수 최대 10글자까지 가능합니다.',
    'settings.nameUpdated': '이름이 변경되었습니다.',
    'settings.nameUpdateFailed': '이름 변경에 실패했습니다.',
    'settings.emailNotification': '이메일 알림',
    'settings.smsNotification': 'SMS 알림',
    'settings.warningNotification': '경고 알림',
    'settings.browserNotification': '브라우저 알림 (FDC 이상감지)',
    'settings.changePassword': '비밀번호 변경',
    'settings.newPassword': '새 비밀번호',
    'settings.confirmPassword': '비밀번호 확인',
    'settings.version': '버전',
    'settings.lastUpdate': '마지막 업데이트',
    
    // 사이드바 (공정 데이터 항목)
    'sidebar.processModel': '공정 실시간 모델',
    'sidebar.dashboard': '공정 현황',
    'sidebar.production': '생산 현황',
    'sidebar.quality': '품질 현황',
    'sidebar.energy': '에너지 현황',
    'sidebar.efficiency': '설비 현황',
    'sidebar.analytics': '불량 원인 분석',
    'sidebar.qualityHeatmap': 'LOT별 합격·불합격',
    'sidebar.defectAnalysis': '최근 품질 불량 분석',
    'sidebar.sensorChart': '센서 차트',
    'sidebar.settings': '설정',
    
    // 네비게이션
    'nav.logout': '로그아웃',
    'nav.login': '로그인',
    
    // 챗봇
    'chatbot.open': '챗봇 열기',
    'chatbot.popup': '팝업',
    'chatbot.close': '챗봇 닫기',
    'chatbot.placeholder': '메시지를 입력하세요...',
    'chatbot.send': '전송',
    'chatbot.greeting': '안녕하세요! 무엇을 도와드릴까요?',
    'chatbot.error': '챗봇과의 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    
    // 공지사항
    'notice.title': '공지사항',
    'notice.add': '공지사항 작성',
    'notice.edit': '수정',
    'notice.delete': '삭제',
    'notice.important': '중요',
    'notice.author': '작성자',
    
    // 커뮤니티
    'community.title': '커뮤니티',
    'community.write': '글 작성',
    'community.replies': '댓글',
    'community.replyPlaceholder': '댓글을 입력하세요...',
    'community.writeReply': '댓글 작성',
    'community.submit': '등록',
    'community.editReply': '댓글 수정',
    'community.deleteReply': '댓글 삭제',
    'community.confirmDeleteReply': '이 댓글을 삭제하시겠습니까?',
    'community.save': '저장',
    'community.cancel': '취소',
    'community.replyRequired': '댓글 내용을 입력해주세요.',
    'community.loginToReply': '댓글을 작성하려면 로그인이 필요합니다.',
    
    // 대시보드 (공정 데이터)
    'dashboard.title': '공정 현황',
    'dashboard.subtitle': '공정 데이터(factory DB) 기반 실시간 현황',
    'dashboard.production': '오늘 생산량',
    'dashboard.productionToday': '공정 데이터 기준',
    'dashboard.productionChange': '전일 대비',
    'dashboard.equipmentRate': '설비 가동률',
    'dashboard.avgRate': '평균 가동률',
    'dashboard.quality': '품질률',
    'dashboard.qualityRate': '양품률',
    'dashboard.goalAchieved': '목표 달성',
    'dashboard.energy': '에너지 사용량',
    'dashboard.energyToday': '오늘 소비량 (kWh)',
    'dashboard.workers': '작업자 수',
    'dashboard.workersCurrent': '현재 근무 중',
    'dashboard.workersShift': '3교대 운영',
    'dashboard.orders': '주문 현황',
    'dashboard.ordersInProgress': '진행 중인 주문',
    'dashboard.ordersCompletion': '완료 예정',
    'dashboard.recentEvents': '최근 공정 이벤트',
    'dashboard.lineStatus': '공정(라인)별 현황',
    'dashboard.lotStatus': '불량 공정 현황',
    'dashboard.lotStatusDesc': 'Lot_id 기준 LOT별 양품률·불량률·생산량·최근 기록',
    'dashboard.lotStatusDescParams': '불합격 LOT만 표시. 합불여부(prediction), 리튬투입량·첨가제비율·공정시간·습도·탱크압력·소결온도 (LOT별 평균)',
    'dashboard.lotId': 'LOT ID',
    'dashboard.completed': '완료',
    'dashboard.warning': '경고',
    'dashboard.info': '정보',
    'dashboard.normal': '정상',
    'dashboard.inspection': '점검 중',
    'dashboard.complete': '완료',
    
    // 생산량 추이
    'production.title': '생산량 추이',
    'production.subtitle': '생산량 데이터 분석 및 모니터링',
    'production.total': '총 생산량',
    'production.avg': '평균 생산량',
    'production.max': '최대 생산량',
    'production.chart': '생산량 추이 차트',
    'production.details': '상세 정보',
    'production.lineStatus': '생산 라인별 현황',
    'production.achievement': '목표 대비 달성률',
    'production.currentPeriod': '현재 기간',
    'production.avgPeriod': '현재 기간 평균',
    'production.peak': '피크 생산량',
    'production.amount': '생산량',
    'production.efficiency': '효율',
    'production.daily': '일별',
    'production.weekly': '주별',
    'production.monthly': '월별',
    
    // 품질 지표
    'quality.title': '품질 현황',
    'quality.subtitle': '공정 데이터 기반 품질 지표',
    'quality.avgRate': '평균 양품률',
    'quality.avgDefect': '평균 불량률',
    'quality.inspected': '검사 건수',
    'quality.totalInspected': '현재 기간 총 검사',
    'quality.trend': '양품률 추이',
    'quality.defectTrend': '불량률 추이',
    'quality.defectTypes': '불량 유형별 통계',
    'quality.targetPass': '목표: 98.0% 이상',
    'quality.targetDefect': '목표: 2.0% 이하',
    'quality.currentPeriod': '현재 기간 평균',
    'quality.lotHourHeatmap': 'LOT/시간대별 품질 분포',
    'quality.lotHourHeatmapDesc': '최근 LOT의 시간대별 합격률 히트맵 (녹색: 양호, 빨강: 불량)',
    
    // 에너지
    'energy.title': '에너지 현황',
    'energy.subtitle': '공정 데이터 기반 에너지 소비량',
    'energy.total': '총 소비량',
    'energy.avg': '평균 소비량',
    'energy.cost': '총 비용',
    'energy.unitPrice': '단가',
    'energy.chart': '에너지 소비 추이',
    'energy.byEquipment': '설비별 소비량',
    'energy.currentPeriod': '현재 기간',
    'energy.unit': '원/kWh',
    
    // 설비 효율
    'efficiency.title': '설비 효율 분석',
    'efficiency.subtitle': '설비 효율 데이터 분석 및 모니터링',
    'efficiency.avg': '평균 효율',
    'efficiency.uptime': '평균 가동률',
    'efficiency.max': '최대 효율',
    'efficiency.chart': '설비 효율 추이',
    'efficiency.byLine': '라인별 효율 현황',
    'efficiency.downtime': '다운타임',
    'efficiency.currentPeriod': '현재 기간 평균',
    'efficiency.peak': '피크 효율',
    'efficiency.efficiency': '효율',
    'efficiency.uptimeLabel': '가동률',
    'efficiency.issues': '이슈',
    
    // 분석
    'analytics.title': '분석',
    'analytics.subtitle': '변수 상관관계, 공정 변수 중요도, Confusion Matrix',
    'analytics.correlation': '변수 간 상관관계',
    'analytics.heatmap': '상관관계 히트맵',
    'analytics.importance': '공정 변수 중요도',
    'analytics.defectAnalysis': '불량 원인 분석',
    'analytics.defectSubtitle': '불량률에 영향을 미치는 공정 변수 분석',
    'analytics.defectFactors': '불량 영향 변수 Top 10',
    'analytics.defectFactorsDesc': '불량률과 상관관계가 높은 공정 변수 (절대값 기준)',
    'analytics.recentDefectLots': '최근 불량 LOT 분석',
    'analytics.recentDefectLotsDesc': '불량률이 높은 LOT의 주요 공정 변수',
    'analytics.defectRate': '불량률',
    'analytics.topFactors': '주요 변수',
    'analytics.target': '타겟',
    'analytics.accuracy': '정확도',
    'analytics.actual': '실제',
    'analytics.predicted': '예측',
    'analytics.noData': '표시할 데이터가 없습니다.',
    
    // 공통 - 요일
    'common.mon': '월',
    'common.tue': '화',
    'common.wed': '수',
    'common.thu': '목',
    'common.fri': '금',
    'common.sat': '토',
    'common.sun': '일',
    
    // 공통 - 상태
    'common.excellent': '우수',
    'common.good': '양호',
    'common.normal': '보통',
    'common.statusNormal': '정상',
    'common.inspection': '점검',
    'common.consumption': '소비량',
    'common.percentage': '비율',
    'common.energyEfficiency': '에너지 효율',
    'common.qualityByLine': '라인별 품질 현황',
  },
  en: {
    // Common
    'dashboard': 'Dashboard',
    'settings': 'Settings',
    'logout': 'Logout',
    'login': 'Login',
    'name': 'Name',
    'employeeNumber': 'Employee Number',
    'admin': 'Admin',
    'employee': 'Employee',
    
    // Settings page
    'settings.title': 'Settings',
    'settings.subtitle': 'System Settings Management',
    'settings.myInfo': 'My Information',
    'settings.general': 'General Settings',
    'settings.notifications': 'Notification Settings',
    'settings.security': 'Security Settings',
    'settings.systemInfo': 'System Information',
    'settings.language': 'Language',
    'settings.korean': '한국어',
    'settings.english': 'English',
    'settings.systemName': 'System Name',
    'settings.updateName': 'Update Name',
    'settings.updating': 'Updating...',
    'settings.namePlaceholder': 'Enter your name',
    'settings.nameRequired': 'Please enter your name.',
    'settings.nameTooLong': 'Name length limit: Non-English max 5 chars, English (including spaces) max 10 chars.',
    'settings.nameMax5': 'Maximum 5 characters allowed.',
    'settings.nameMax10': 'Maximum 10 characters allowed.',
    'settings.nameUpdated': 'Name has been updated.',
    'settings.nameUpdateFailed': 'Failed to update name.',
    'settings.emailNotification': 'Email Notifications',
    'settings.smsNotification': 'SMS Notifications',
    'settings.warningNotification': 'Warning Notifications',
    'settings.browserNotification': 'Browser Notifications (FDC Alerts)',
    'settings.changePassword': 'Change Password',
    'settings.newPassword': 'New Password',
    'settings.confirmPassword': 'Confirm Password',
    'settings.version': 'Version',
    'settings.lastUpdate': 'Last Update',
    
    // Sidebar (process data)
    'sidebar.processModel': 'Process Real-time Model',
    'sidebar.dashboard': 'Process Overview',
    'sidebar.production': 'Production',
    'sidebar.quality': 'Quality',
    'sidebar.energy': 'Energy',
    'sidebar.efficiency': 'Equipment',
    'sidebar.analytics': 'Defect Root Cause Analysis',
    'sidebar.qualityHeatmap': 'LOT Pass / Fail',
    'sidebar.defectAnalysis': 'Recent Quality Defect Analysis',
    'sidebar.sensorChart': 'Sensor Chart',
    'sidebar.settings': 'Settings',
    
    // Navigation
    'nav.logout': 'Logout',
    'nav.login': 'Login',
    
    // Chatbot
    'chatbot.open': 'Open Chatbot',
    'chatbot.popup': 'Popup',
    'chatbot.close': 'Close Chatbot',
    'chatbot.placeholder': 'Enter your message...',
    'chatbot.send': 'Send',
    'chatbot.greeting': 'Hello! How can I help you?',
    'chatbot.error': 'An error occurred while communicating with the chatbot. Please try again later.',
    
    // Notices
    'notice.title': 'Notices',
    'notice.add': 'Add Notice',
    'notice.edit': 'Edit',
    'notice.delete': 'Delete',
    'notice.important': 'Important',
    'notice.author': 'Author',
    
    // Community
    'community.title': 'Community',
    'community.write': 'Write Post',
    'community.replies': 'Replies',
    'community.replyPlaceholder': 'Enter your reply...',
    'community.writeReply': 'Write Reply',
    'community.submit': 'Submit',
    'community.editReply': 'Edit reply',
    'community.deleteReply': 'Delete reply',
    'community.confirmDeleteReply': 'Delete this reply?',
    'community.save': 'Save',
    'community.cancel': 'Cancel',
    'community.replyRequired': 'Please enter a message.',
    'community.loginToReply': 'Please login to write a reply.',
    
    // Dashboard (process data)
    'dashboard.title': 'Process Overview',
    'dashboard.subtitle': 'Live status from process data (factory DB)',
    'dashboard.production': 'Today\'s Production',
    'dashboard.productionToday': 'From process data',
    'dashboard.productionChange': 'vs Previous Day',
    'dashboard.equipmentRate': 'Equipment Utilization',
    'dashboard.avgRate': 'Average Rate',
    'dashboard.quality': 'Quality Rate',
    'dashboard.qualityRate': 'Pass Rate',
    'dashboard.goalAchieved': 'Goal Achieved',
    'dashboard.energy': 'Energy Consumption',
    'dashboard.energyToday': 'Today (kWh)',
    'dashboard.workers': 'Workers',
    'dashboard.workersCurrent': 'Currently Working',
    'dashboard.workersShift': '3-Shift',
    'dashboard.orders': 'Orders',
    'dashboard.ordersInProgress': 'In Progress',
    'dashboard.ordersCompletion': 'Expected',
    'dashboard.recentEvents': 'Recent Process Events',
    'dashboard.lineStatus': 'Status by Line',
    'dashboard.lotStatus': 'Process Status by LOT',
    'dashboard.lotStatusDesc': 'Pass rate, defect rate, quantity, and latest record per Lot_id',
    'dashboard.lotStatusDescParams': 'Only failed LOTs. prediction, lithium_input, additive_ratio, process_time, humidity, tank_pressure, sintering_temp (LOT average)',
    'dashboard.lotId': 'LOT ID',
    'dashboard.completed': 'Completed',
    'dashboard.warning': 'Warning',
    'dashboard.info': 'Info',
    'dashboard.normal': 'Normal',
    'dashboard.inspection': 'Under Inspection',
    'dashboard.complete': 'Complete',
    
    // Production (process data)
    'production.title': 'Production',
    'production.subtitle': 'Production trend from process data',
    'production.total': 'Total Production',
    'production.avg': 'Average Production',
    'production.max': 'Maximum Production',
    'production.chart': 'Production Trend Chart',
    'production.details': 'Details',
    'production.lineStatus': 'Status by Production Line',
    'production.achievement': 'Achievement Rate vs Target',
    'production.currentPeriod': 'Current Period',
    'production.avgPeriod': 'Average for Current Period',
    'production.peak': 'Peak Production',
    'production.amount': 'Production',
    'production.efficiency': 'Efficiency',
    'production.daily': 'Daily',
    'production.weekly': 'Weekly',
    'production.monthly': 'Monthly',
    
    // Quality (process data)
    'quality.title': 'Quality',
    'quality.subtitle': 'Quality metrics from process data',
    'quality.avgRate': 'Average Pass Rate',
    'quality.avgDefect': 'Average Defect Rate',
    'quality.inspected': 'Inspected Items',
    'quality.totalInspected': 'Total Inspected (Current Period)',
    'quality.trend': 'Pass Rate Trend',
    'quality.defectTrend': 'Defect Rate Trend',
    'quality.defectTypes': 'Defect Types Statistics',
    'quality.targetPass': 'Target: 98.0% or above',
    'quality.targetDefect': 'Target: 2.0% or below',
    'quality.currentPeriod': 'Average for Current Period',
    
    // Energy (process data)
    'energy.title': 'Energy',
    'energy.subtitle': 'Energy consumption from process data',
    'energy.total': 'Total Consumption',
    'energy.avg': 'Average Consumption',
    'energy.cost': 'Total Cost',
    'energy.unitPrice': 'Unit Price',
    'energy.chart': 'Energy Consumption Trend',
    'energy.byEquipment': 'Consumption by Equipment',
    'energy.currentPeriod': 'Current Period',
    'energy.unit': 'KRW/kWh',
    
    // Equipment (process data)
    'efficiency.title': 'Equipment',
    'efficiency.subtitle': 'Equipment utilization and efficiency from process data',
    'efficiency.avg': 'Average Efficiency',
    'efficiency.uptime': 'Average Uptime',
    'efficiency.max': 'Maximum Efficiency',
    'efficiency.chart': 'Equipment Efficiency Trend',
    'efficiency.byLine': 'Efficiency Status by Line',
    'efficiency.downtime': 'Downtime',
    'efficiency.currentPeriod': 'Average for Current Period',
    'efficiency.peak': 'Peak Efficiency',
    'efficiency.efficiency': 'Efficiency',
    'efficiency.uptimeLabel': 'Uptime',
    'efficiency.issues': 'Issues',
    
    // Analytics
    'analytics.title': 'Analytics',
    'analytics.subtitle': 'Correlation, variable importance, confusion matrix',
    'analytics.correlation': 'Variable correlation',
    'analytics.heatmap': 'Correlation heatmap',
    'analytics.importance': 'Variable importance',
    'analytics.defectAnalysis': 'Defect Root Cause Analysis',
    'analytics.defectSubtitle': 'Analyze process variables affecting defect rate',
    'analytics.defectFactors': 'Top 10 Defect Impact Variables',
    'analytics.defectFactorsDesc': 'Process variables with high correlation to defect rate',
    'analytics.recentDefectLots': 'Recent Defect LOT Analysis',
    'analytics.recentDefectLotsDesc': 'Key process variables of high-defect LOTs',
    'analytics.defectRate': 'Defect Rate',
    'analytics.topFactors': 'Key Variables',
    'analytics.target': 'Target',
    'analytics.accuracy': 'Accuracy',
    'analytics.actual': 'Actual',
    'analytics.predicted': 'Predicted',
    'analytics.noData': 'No data to display.',
    
    // Common - Days of week
    'common.mon': 'Mon',
    'common.tue': 'Tue',
    'common.wed': 'Wed',
    'common.thu': 'Thu',
    'common.fri': 'Fri',
    'common.sat': 'Sat',
    'common.sun': 'Sun',
    
    // Common - Status
    'common.excellent': 'Excellent',
    'common.good': 'Good',
    'common.normal': 'Normal',
    'common.statusNormal': 'Normal',
    'common.inspection': 'Inspection',
    'common.consumption': 'Consumption',
    'common.percentage': 'Percentage',
    'common.energyEfficiency': 'Energy Efficiency',
    'common.qualityByLine': 'Quality Status by Line',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // 초기 상태는 항상 'ko'로 설정 (서버와 클라이언트 일치)
  const [language, setLanguageState] = useState<Language>('ko');
  const [isMounted, setIsMounted] = useState(false);

  // 컴포넌트 마운트 후 localStorage에서 언어 설정 로드
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('language') as Language;
      if (savedLanguage && (savedLanguage === 'ko' || savedLanguage === 'en')) {
        setLanguageState(savedLanguage);
      }
    }
  }, []);

  // 언어 변경 함수
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang);
    }
  };

  // 번역 함수
  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/ko';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('ko');
dayjs.tz.setDefault('Asia/Seoul');

const SEOUL = 'Asia/Seoul';

/** DB/서버에서 오는 값을 Asia/Seoul 시각으로 변환해 시각만 포맷 (예: 오전 11:30). DB는 UTC로 저장. */
export function formatTimeSeoul(date: Date | string): string {
  if (date instanceof Date) {
    return dayjs(date).tz(SEOUL).format('A h:mm');
  }
  const d = String(date).trim().replace('T', ' ').slice(0, 19);
  const parsed = d.endsWith('Z') || d.includes('+') ? dayjs.utc(date).tz(SEOUL) : dayjs.utc(d).tz(SEOUL);
  return parsed.format('A h:mm');
}

/** Asia/Seoul 기준 오전/오후 HH:mm:ss 포맷 (헤더 '마지막 업데이트'와 동일). Date 또는 DB 문자열. */
export function formatTimeSeoulWithSeconds(date: Date | string): string {
  if (date instanceof Date) {
    return dayjs(date).tz(SEOUL).format('A h:mm:ss');
  }
  const d = String(date).trim().replace('T', ' ').slice(0, 19);
  const parsed = d.endsWith('Z') || d.includes('+') ? dayjs.utc(date).tz(SEOUL) : dayjs.utc(d).tz(SEOUL);
  return parsed.format('A h:mm:ss');
}

/** DB/서버에서 오는 값을 Asia/Seoul 날짜로 변환해 날짜만 포맷 (예: 2025. 2. 12.). DB는 UTC로 저장. */
export function formatDateSeoul(date: Date | string): string {
  if (date instanceof Date) {
    return dayjs(date).tz(SEOUL).format('YYYY. M. D.').replace(/\s/g, '');
  }
  const d = String(date).trim().replace('T', ' ').slice(0, 19);
  const parsed = d.endsWith('Z') || d.includes('+') ? dayjs.utc(date).tz(SEOUL) : dayjs.utc(d).tz(SEOUL);
  return parsed.format('YYYY. M. D.').replace(/\s/g, '');
}

/** 현재 시각을 UTC로 'YYYY-MM-DD HH:mm:ss' 반환 (DB 저장용, 조회 시 formatTimeSeoul/formatDateSeoul로 KST 표시) */
export function nowKstForDb(): string {
  return dayjs().utc().format('YYYY-MM-DD HH:mm:ss');
}

/**
 * Infinity, NaN 값을 안전한 값으로 변환하는 함수
 * JSON.parse 후에도 Infinity/NaN이 있을 수 있으므로 안전하게 처리
 */

/**
 * 숫자가 Infinity나 NaN인지 확인하고 null로 변환
 */
function sanitizeNumber(value: number): number | null {
  if (typeof value !== 'number') return value;
  if (!Number.isFinite(value)) {
    // Infinity, -Infinity, NaN을 null로 변환
    return null;
  }
  return value;
}

/**
 * 객체를 재귀적으로 순회하며 Infinity/NaN 값을 제거하는 함수
 */
export function sanitizeForJSON(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'number') {
    return sanitizeNumber(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForJSON(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeForJSON(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * 영어 컬럼명 ↔ 한국어 자연어 매칭 유틸리티
 * 사용자 질문(자연어)에서 DB 컬럼을 유연하게 찾아줍니다.
 */

/** 영어 단어 → 한국어 번역 사전 (공정/제조 도메인) */
const EN_KO_DICT: Record<string, string[]> = {
  // 원소/물질
  lithium: ['리튬', '리티움'],
  cobalt: ['코발트'],
  nickel: ['니켈'],
  manganese: ['망간'],
  aluminum: ['알루미늄', '알미늄'],
  copper: ['구리', '동'],
  iron: ['철', '아이언'],
  carbon: ['탄소', '카본'],
  oxygen: ['산소'],
  hydrogen: ['수소'],
  nitrogen: ['질소'],
  sulfur: ['황', '유황'],
  phosphorus: ['인'],
  silicon: ['규소', '실리콘'],
  zinc: ['아연'],
  lead: ['납'],
  sodium: ['나트륨', '소듐'],
  potassium: ['칼륨', '포타슘'],
  calcium: ['칼슘'],
  magnesium: ['마그네슘'],
  titanium: ['티타늄', '티타니움'],
  electrolyte: ['전해질', '전해액'],
  slurry: ['슬러리'],
  binder: ['바인더', '결합제'],
  solvent: ['용매', '용제'],
  additive: ['첨가제', '첨가물'],
  cathode: ['양극', '캐소드'],
  anode: ['음극', '애노드'],
  separator: ['분리막', '세퍼레이터'],
  electrode: ['전극'],
  coating: ['코팅', '도포'],

  // 동작/상태
  input: ['투입', '투입량', '입력', '넣은', '들어간'],
  output: ['출력', '배출', '생산', '나온'],
  consumption: ['소비', '소비량', '사용량'],
  usage: ['사용', '사용량', '이용'],
  flow: ['유량', '흐름', '플로우'],
  rate: ['률', '비율', '속도', '레이트'],
  speed: ['속도', '스피드'],
  pressure: ['압력', '압'],
  temperature: ['온도', '열', '템퍼러처'],
  humidity: ['습도'],
  weight: ['무게', '중량', '웨이트'],
  volume: ['부피', '용량', '볼륨'],
  density: ['밀도', '농도'],
  thickness: ['두께'],
  width: ['폭', '너비'],
  length: ['길이'],
  size: ['크기', '사이즈'],
  count: ['개수', '수', '카운트'],
  quantity: ['수량', '양', '개수'],
  amount: ['양', '총량', '금액'],
  total: ['합계', '총', '토탈'],
  average: ['평균', '에버리지'],
  max: ['최대', '맥스', '최댓값'],
  min: ['최소', '민', '최솟값'],
  time: ['시간', '타임'],
  duration: ['시간', '기간', '지속시간'],
  cycle: ['사이클', '주기'],
  batch: ['배치', '뱃치'],
  lot: ['로트', '롯', 'LOT'],

  // 품질/결과
  pass: ['합격', '양품', '패스', 'OK'],
  fail: ['불합격', '불량', '페일', 'NG'],
  defect: ['불량', '결함', '하자'],
  quality: ['품질', '퀄리티'],
  efficiency: ['효율', '능률'],
  yield: ['수율', '생산성'],
  capacity: ['용량', '캐퍼시티'],
  voltage: ['전압', '볼트'],
  current: ['전류', '암페어'],
  power: ['전력', '파워', '출력'],
  energy: ['에너지', '열량'],
  resistance: ['저항', '레지스턴스'],

  // 설비/장치
  machine: ['기계', '머신', '설비'],
  equipment: ['장비', '설비'],
  line: ['라인', '공정', '생산라인'],
  station: ['스테이션', '공정'],
  chamber: ['챔버', '룸'],
  oven: ['오븐', '가열기'],
  mixer: ['믹서', '혼합기'],
  roller: ['롤러', '압연기'],
  dryer: ['건조기', '드라이어'],
  coater: ['코터', '코팅기'],
  stacker: ['스태커', '적층기'],
  winder: ['와인더', '권취기'],
  cutter: ['커터', '절단기'],
  press: ['프레스', '압착기'],

  // 기타
  date: ['날짜', '일자', '일시'],
  created: ['생성', '등록'],
  recorded: ['기록', '측정'],
  value: ['값', '수치'],
  status: ['상태', '스테이터스'],
  id: ['아이디', '번호', 'ID'],
  name: ['이름', '명칭', '네임'],
  type: ['유형', '타입', '종류'],
  level: ['레벨', '수준', '단계'],
};

/** 한국어 → 영어 역방향 사전 (자동 생성) */
const KO_EN_DICT: Record<string, string[]> = {};
for (const [en, koList] of Object.entries(EN_KO_DICT)) {
  for (const ko of koList) {
    if (!KO_EN_DICT[ko]) KO_EN_DICT[ko] = [];
    if (!KO_EN_DICT[ko].includes(en)) KO_EN_DICT[ko].push(en);
  }
}

/** 컬럼명을 단어로 분리 (snake_case, camelCase) */
function splitColumnName(col: string): string[] {
  return col
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[_\-\s]+/)
    .filter(Boolean);
}

/** 영어 컬럼명을 한국어 설명으로 변환 */
export function columnToKorean(col: string): string {
  const words = splitColumnName(col);
  const korean = words.map((w) => EN_KO_DICT[w]?.[0] || w);
  return korean.join(' ');
}

/** 한국어 키워드를 영어 단어들로 변환 */
export function koreanToEnglish(text: string): string[] {
  const result: string[] = [];
  const lower = text.toLowerCase();

  // 한국어 사전에서 매칭
  for (const [ko, enList] of Object.entries(KO_EN_DICT)) {
    if (lower.includes(ko)) {
      result.push(...enList);
    }
  }

  // 영어 단어도 그대로 추출
  const englishWords = lower.match(/[a-z]+/g) || [];
  result.push(...englishWords);

  return [...new Set(result)];
}

/** 사용자 질문에서 숫자 추출 (LOT 수, 개수 등) */
export function extractNumber(text: string): number | null {
  // "최근 100개", "100개의", "100 개" 등
  const match = text.match(/(\d+)\s*(개|건|회|개의|건의|LOT|lot|로트)/i);
  if (match) return parseInt(match[1], 10);
  // "최근 100" 등
  const match2 = text.match(/최근\s*(\d+)/);
  if (match2) return parseInt(match2[1], 10);
  return null;
}

/** LOT/배치 관련 질문인지 확인 */
export function isLotQuery(text: string): boolean {
  return /LOT|lot|로트|롯|배치|뱃치|batch/i.test(text);
}

/**
 * 사용자 질문과 DB 컬럼 목록을 비교하여 관련 컬럼을 찾습니다.
 * @param query 사용자 질문
 * @param columns DB 컬럼 목록 [{name, type}]
 * @returns 매칭된 컬럼명 배열 (점수 높은 순)
 */
export function matchColumns(
  query: string,
  columns: { name: string; type: string }[]
): { column: string; score: number; reason: string }[] {
  const queryLower = query.toLowerCase();
  const queryEnglish = koreanToEnglish(query);
  const results: { column: string; score: number; reason: string }[] = [];

  for (const col of columns) {
    const colLower = col.name.toLowerCase();
    const colWords = splitColumnName(col.name);
    let score = 0;
    let reason = '';

    // 1. 정확히 일치 (최고 점수)
    if (queryLower.includes(colLower) || queryLower.includes(col.name)) {
      score += 100;
      reason = '컬럼명 직접 언급';
    }

    // 2. 컬럼명의 각 단어가 질문의 영어 변환에 포함
    for (const word of colWords) {
      if (queryEnglish.includes(word)) {
        score += 30;
        reason = reason || `키워드 매칭: ${word}`;
      }
    }

    // 3. 컬럼의 한국어 번역이 질문에 포함
    for (const word of colWords) {
      const koTranslations = EN_KO_DICT[word] || [];
      for (const ko of koTranslations) {
        if (queryLower.includes(ko)) {
          score += 40;
          reason = reason || `한국어 매칭: ${ko} → ${word}`;
        }
      }
    }

    if (score > 0) {
      results.push({ column: col.name, score, reason });
    }
  }

  // 점수 높은 순 정렬
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * 컬럼 목록을 한국어 설명과 함께 반환 (LLM 컨텍스트용)
 */
export function describeColumns(columns: { name: string; type: string }[]): string {
  return columns
    .map((c) => `- ${c.name} (${c.type}): ${columnToKorean(c.name)}`)
    .join('\n');
}

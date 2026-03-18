import path from 'path';
import { query } from './db';
import { SimpleVectorStore } from './simple-vector-store';
// Google Generative AI는 백엔드로 전환되어 프론트엔드에서는 사용하지 않음
// import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
// import { GoogleGenerativeAI } from '@google/generative-ai';

const CHROMA_PATH = process.env.CHROMA_PATH || path.resolve(process.cwd(), '.chroma');
const LOT_REPORTS_STORE_PATH = path.join(CHROMA_PATH, 'lot_defect_reports');

let lotReportsVectorStore: SimpleVectorStore | null = null;

function getLotReportsVectorStore(): SimpleVectorStore {
  if (!lotReportsVectorStore) {
    lotReportsVectorStore = new SimpleVectorStore(LOT_REPORTS_STORE_PATH);
  }
  return lotReportsVectorStore;
}

/** lot_defect_reports 테이블 생성 */
export async function ensureLotReportsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS lot_defect_reports (
      id INT NOT NULL DEFAULT 0,
      lot_id VARCHAR(100) NOT NULL PRIMARY KEY,
      report_content TEXT NOT NULL,
      lot_data_json JSON,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_id (id),
      INDEX idx_timestamp (timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/** MariaDB에서 레포트 조회 */
export async function getReportFromDb(lotId: string): Promise<{ report_content: string } | null> {
  const rows = (await query(
    'SELECT report_content FROM lot_defect_reports WHERE lot_id = ?',
    [lotId]
  )) as { report_content: string }[];
  return rows.length > 0 ? rows[0] : null;
}

/** MariaDB에 레포트 저장 */
export async function saveReportToDb(
  lotId: string,
  reportContent: string,
  lotDataJson?: Record<string, unknown>
) {
  const jsonStr = lotDataJson ? JSON.stringify(lotDataJson) : null;
  await query(
    `INSERT INTO lot_defect_reports (id, lot_id, report_content, lot_data_json, timestamp)
     VALUES (0, ?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE report_content = VALUES(report_content), lot_data_json = VALUES(lot_data_json), timestamp = CURRENT_TIMESTAMP`,
    [lotId, reportContent, jsonStr]
  );
}

/** ChromaDB(벡터 스토어)에 레포트 저장 (백엔드로 전환되어 사용하지 않음) */
export async function saveReportToChroma(
  lotId: string,
  reportContent: string,
  embedding: number[]
) {
  // 백엔드로 전환되어 프론트엔드에서는 사용하지 않음
  throw new Error('saveReportToChroma is not available in frontend. Use backend API instead.');
}

/** AI로 불량 원인 레포트 생성 - 백엔드 API 사용. 신규 양식: 불량 원인 분석, 불량 발생 메커니즘, 권장 조치사항 */
export async function generateDefectReport(
  lotId: string,
  lotData: {
    passFailResult: string | null;
    lithiumInput: number | null;
    addictiveRatio: number | null;
    processTime: number | null;
    humidity: number | null;
    tankPressure: number | null;
    recordCount: number;
    latestDate: string | null;
    params: Record<string, number>;
  },
  language: 'ko' | 'en' = 'ko'
): Promise<string> {
  // 백엔드로 전환되어 프론트엔드에서는 사용하지 않음
  throw new Error('generateDefectReport is not available in frontend. Use backend API instead.');
  
  /* 기존 코드 (백엔드로 전환되어 주석 처리)
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
  }

  const paramsStr =
    Object.keys(lotData.params || {}).length > 0
      ? Object.entries(lotData.params)
          .map(([k, v]) => `  ${k}: ${Number(v).toFixed(4)}`)
          .join('\n')
      : '';

  const prompt =
    language === 'ko'
      ? `다음 불량 LOT에 대한 "불량 원인 분석 레포트"를 작성해주세요. 레포트는 다음 형식으로 작성해주세요:
1. 요약 (한 문단)
2. 원인 분석 (공정 파라미터별 이상 여부)
3. 권장 조치

--- LOT 데이터 ---
LOT ID: ${lotId}
판정: ${lotData.passFailResult ?? '-'}
리튬 투입량: ${lotData.lithiumInput != null ? `${lotData.lithiumInput.toFixed(4)} kg` : '-'}
첨가제 비율: ${lotData.addictiveRatio != null ? lotData.addictiveRatio.toFixed(4) : '-'}
공정 시간: ${lotData.processTime != null ? `${lotData.processTime.toFixed(2)} 분` : '-'}
습도: ${lotData.humidity != null ? `${lotData.humidity.toFixed(2)}%` : '-'}
탱크 압력: ${lotData.tankPressure != null ? `${lotData.tankPressure.toFixed(2)} kPa` : '-'}
기록 수: ${lotData.recordCount}
최근 기록: ${lotData.latestDate ?? '-'}
${paramsStr ? `기타 파라미터:\n${paramsStr}` : ''}`
      : `Write a "Defect Cause Analysis Report" for the following failed LOT. Format: 1) Summary 2) Cause analysis by process parameters 3) Recommended actions.

--- LOT Data ---
LOT ID: ${lotId}
Result: ${lotData.passFailResult ?? '-'}
Lithium input: ${lotData.lithiumInput != null ? `${lotData.lithiumInput.toFixed(4)} kg` : '-'}
Additive ratio: ${lotData.addictiveRatio != null ? lotData.addictiveRatio.toFixed(4) : '-'}
Process time: ${lotData.processTime != null ? `${lotData.processTime.toFixed(2)} min` : '-'}
Humidity: ${lotData.humidity != null ? `${lotData.humidity.toFixed(2)}%` : '-'}
Tank pressure: ${lotData.tankPressure != null ? `${lotData.tankPressure.toFixed(2)} kPa` : '-'}
Record count: ${lotData.recordCount}
Latest: ${lotData.latestDate ?? '-'}
${paramsStr ? `Other params:\n${paramsStr}` : ''}`;

  const genAI = new GoogleGenerativeAI(apiKey);

  // 404 방지: ListModels로 사용 가능한 모델 확인 후 시도
  let modelCandidates = [
    process.env.GEMINI_MODEL_NAME,
    'gemini-pro',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ].filter(Boolean) as string[];

  try {
    const modelsRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    if (modelsRes.ok) {
      const data = (await modelsRes.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
      const supported = (data.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => m.name.replace('models/', ''))
        .filter((m) => m.includes('gemini') && !m.toLowerCase().includes('computer-use'));
      if (supported.length > 0) {
        modelCandidates = [process.env.GEMINI_MODEL_NAME, ...supported].filter(Boolean) as string[];
      }
    }
  } catch {
    // ListModels 실패 시 기본 목록 사용
  }

  const seen = new Set<string>();
  const uniqueModels = modelCandidates.filter((m) => {
    const t = String(m).trim().replace(/^models\//, '');
    if (!t || seen.has(t)) return false;
    const lower = t.toLowerCase();
    // 특수 모델 제외 (computer-use, robotics, vision, imagen 등)
    if (lower.includes('computer-use') || lower.includes('robotics') || lower.includes('vision') || lower.includes('imagen')) {
      return false;
    }
    seen.add(t);
    return true;
  });

  const systemInstruction =
    language === 'ko'
      ? '마크다운 기호(*, #, -, >)를 사용하지 마세요. 일반 텍스트로만 답변하세요.'
      : 'Do not use markdown symbols. Plain text only.';

  const fullPrompt = `${systemInstruction}\n\n${prompt}`;
  let lastError: Error | null = null;

  for (const modelName of uniqueModels) {
    const normalized = modelName.trim().replace(/^models\//, '');
    try {
      const model = genAI.getGenerativeModel({ model: normalized });
      const response = await model.generateContent(fullPrompt);
      const result = response.response;
      return result.text();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[lot-report] Model ${normalized} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('모든 Gemini 모델 시도 실패');
  */
}

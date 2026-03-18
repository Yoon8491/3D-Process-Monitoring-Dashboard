import { query } from '@/lib/db';

/** 커뮤니티 댓글 테이블(communication_replies). 스키마 확인 시 이 테이블만 사용합니다. */
const COMMENT_TABLE = 'communication_replies';

/**
 * communication_replies 테이블에 likes_count, dislikes_count 컬럼이 없으면
 * INT NOT NULL DEFAULT 0 으로 추가합니다. (MariaDB 수동 마이그레이션 대체)
 */
export async function ensureCommentLikesColumns(): Promise<void> {
  try {
    await query(
      `SELECT \`likes_count\`, \`dislikes_count\` FROM \`${COMMENT_TABLE}\` LIMIT 0`,
      []
    );
    return; // 컬럼 있음
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (err?.code !== 'ER_BAD_FIELD_ERROR' && !msg.includes('Unknown column')) {
      throw err;
    }
  }

  try {
    await query(
      `ALTER TABLE \`${COMMENT_TABLE}\` ADD COLUMN \`likes_count\` INT NOT NULL DEFAULT 0`,
      []
    );
  } catch (e: any) {
    if (e?.code !== 'ER_DUP_FIELDNAME' && !String(e?.message || '').includes('Duplicate column')) {
      console.error('ensureCommentLikesColumns: likes_count 추가 실패', e);
    }
  }
  try {
    await query(
      `ALTER TABLE \`${COMMENT_TABLE}\` ADD COLUMN \`dislikes_count\` INT NOT NULL DEFAULT 0`,
      []
    );
  } catch (e: any) {
    if (e?.code !== 'ER_DUP_FIELDNAME' && !String(e?.message || '').includes('Duplicate column')) {
      console.error('ensureCommentLikesColumns: dislikes_count 추가 실패', e);
    }
  }
}

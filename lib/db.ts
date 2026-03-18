import mysql from 'mysql2/promise';

let authPool: mysql.Pool | null = null;

/** 인증(로그인/회원가입/이름변경) 전용 DB 풀. AUTH_DB_* 가 있으면 해당 DB, 없으면 DB_* 사용 */
export function getDbPool(): mysql.Pool {
  if (!authPool) {
    const useAuthDb =
      process.env.AUTH_DB_HOST != null ||
      process.env.AUTH_DB_NAME != null;
    authPool = mysql.createPool({
      host: useAuthDb
        ? (process.env.AUTH_DB_HOST || 'localhost')
        : (process.env.DB_HOST || 'localhost'),
      port: parseInt(
        useAuthDb
          ? (process.env.AUTH_DB_PORT || process.env.DB_PORT || '3306')
          : (process.env.DB_PORT || '3306'),
        10
      ),
      user: useAuthDb
        ? (process.env.AUTH_DB_USER || process.env.DB_USER || 'root')
        : (process.env.DB_USER || 'root'),
      password: useAuthDb
        ? (process.env.AUTH_DB_PASSWORD ?? process.env.DB_PASSWORD ?? '')
        : (process.env.DB_PASSWORD || ''),
      database: useAuthDb
        ? (process.env.AUTH_DB_NAME || process.env.DB_NAME || 'manufacturing_db')
        : (process.env.DB_NAME || 'manufacturing_db'),
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
    authPool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }
  return authPool;
}

export async function query(sql: string, params?: any[]): Promise<any> {
  let connection;
  try {
    connection = await getDbPool().getConnection();
    const [results] = await connection.execute(sql, params);
    return results;
  } catch (error: any) {
    console.error('Database query error:', {
      message: error?.message,
      code: error?.code,
      sql: sql?.slice(0, 200),
      params: params,
      stack: error?.stack,
    });
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

import Database from '@tauri-apps/plugin-sql';
import { appDataDir } from '@tauri-apps/api/path';
import { join } from '@tauri-apps/api/path';

export interface PraseFrame {
    id?: number;
    frame: string;
    created_at?: string;
    updated_at?: string;
}

// 数据库连接实例
let db: Database | null = null;

// 初始化数据库
export async function initDatabase() {
    if (db) return db;

    const appDataDirPath = await appDataDir();
    console.log(appDataDirPath);
    const dbPath = await join(appDataDirPath, 'embedtalk.db');
    
    db = await Database.load(`sqlite:${dbPath}`);
    
    // 创建表
    await db.execute(`
        CREATE TABLE IF NOT EXISTS praseframe (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            frame TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    return db;
}

// 创建新消息
export async function createPraseFrame(frame: string, limit: number = 100): Promise<PraseFrame> {
    const db = await initDatabase();
    await maintainHistoryLimit(limit);
    
    const result = await db.execute('INSERT INTO praseframe (frame) VALUES (?)', [frame]);
    const id = result.lastInsertId;
    
    const messages = await db.select<PraseFrame[]>(
        'SELECT * FROM praseframe WHERE id = ?',
        [id]
    );
    
    return messages[0];
}

// 获取所有消息
export async function getPraseFrames(): Promise<PraseFrame[]> {
    const db = await initDatabase();
    return db.select<PraseFrame[]>('SELECT * FROM praseframe ORDER BY created_at DESC');
}

// 更新消息
export async function updatePraseFrame(id: number, frame: string): Promise<PraseFrame> {
    const db = await initDatabase();
    await db.execute(
        'UPDATE praseframe SET frame = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [frame, id]
    );
    
    const messages = await db.select<PraseFrame[]>(
        'SELECT * FROM praseframe WHERE id = ?',
        [id]
    );
    
    return messages[0];
}

// 删除消息
export async function deletePraseFrame(id: number): Promise<void> {
    const db = await initDatabase();
    await db.execute('DELETE FROM praseframe WHERE id = ?', [id]);
}

// 根据条件查询消息
export async function searchPraseFrames(query: string): Promise<PraseFrame[]> {
    const db = await initDatabase();
    return db.select<PraseFrame[]>(
        'SELECT * FROM praseframe WHERE frame LIKE ? ORDER BY created_at DESC',
        [`%${query}%`]
    );
}

// 获取指定时间范围内的消息
export async function getPraseFramesByDateRange(startDate: string, endDate: string): Promise<PraseFrame[]> {
    const db = await initDatabase();
    return db.select<PraseFrame[]>(
        'SELECT * FROM praseframe WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC',
        [startDate, endDate]
    );
}

// 获取历史记录数量
export async function getPraseFrameCount(): Promise<number> {
    const db = await initDatabase();
    const result = await db.select<[{ count: number }]>('SELECT COUNT(*) as count FROM praseframe');
    return result[0].count;
}

// 删除最旧的记录，保持在限制数量以内
export async function maintainHistoryLimit(limit: number): Promise<void> {
    const db = await initDatabase();
    const count = await getPraseFrameCount();
    if (count > limit) {
        const deleteCount = count - limit;
        await db.execute(
            'DELETE FROM praseframe WHERE id IN (SELECT id FROM praseframe ORDER BY created_at ASC LIMIT ?)',
            [deleteCount]
        );
    }
}

// 删除单条记录
export async function deletePraseFrameById(id: number): Promise<void> {
    const db = await initDatabase();
    await db.execute('DELETE FROM praseframe WHERE id = ?', [id]);
}

// 清空所有记录
export async function clearAllPraseFrames(): Promise<void> {
    const db = await initDatabase();
    await db.execute('DELETE FROM praseframe');
}

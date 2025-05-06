import { useRef } from 'react';
import Database from '@tauri-apps/plugin-sql';
import { TaskData } from '../store/slices/taskAnalysisSlice';

export const useDbWorker = () => {
    const workerRef = useRef<Worker | null>(null);
    const dbRef = useRef<any>(null);

    const loadDatabase = async (filePath: string): Promise<TaskData[]> => {
        try {
            // 关闭之前的数据库连接
            await closeDatabase();
            
            // 连接数据库
            const dbPath = `sqlite:${filePath}`;
            console.log('Connecting to database:', dbPath);
            dbRef.current = await Database.load(dbPath);
            
            // 查询数据
            console.log('Executing query...');
            const result = await dbRef.current.select(`
                SELECT 
                    t.TASK_ID as task_id,
                    t.PROJECT_ID as project_id,
                    t.PROJECT_TYPE as project_type,
                    t.EXEC_CYCLE_UNIT as exec_cycle_unit,
                    t.EXEC_CYCLE as exec_cycle,
                    t.BEGIN_TIME as begin_time,
                    t.END_TIME as end_time,
                    t.DELAY_UNIT as delay_unit,
                    t.DELAY_TIME as delay_time,
                    t.PRIORITY as priority,
                    t.STATUS as status,
                    t.BEFORE_SCRIPT_ID as before_script_id,
                    t.AFTER_SCRIPT_ID as after_script_id,
                    hex(t.EXEC_PERIOD) as exec_period,
                    t.TASK_CS as task_cs,
                    t.OP_TIME as op_time,
                    p.DEPTH as depth,
                    p.ACQ_TYPE as acq_type,
                    hex(p.ACQ_CONTENT) as acq_content,
                    hex(p.ACQ_SET) as acq_set,
                    p.TD_OPTION as td_option,
                    p.PROJECT_CS as project_cs
                FROM METER_TASK t
                LEFT JOIN METER_EX_PROJECT p ON t.PROJECT_ID = p.PLAN_ID
                ORDER BY t.TASK_ID
            `);
            console.log('Query result length:', result?.length);

            return result || [];
        } catch (err) {
            console.error('Database operation failed:', err);
            throw err;
        }
    };

    const closeDatabase = async () => {
        if (dbRef.current) {
            try {
                await dbRef.current.close();
                dbRef.current = null;
            } catch (err) {
                console.error('Failed to close database:', err);
                throw err;
            }
        }
    };

    return {
        loadDatabase,
        closeDatabase
    };
};
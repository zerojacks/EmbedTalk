/// <reference lib="webworker" />

interface TaskData {
    task_id: number;
    project_id: number;
    project_type: number;
    exec_cycle_unit: number;
    exec_cycle: number;
    begin_time: number;
    end_time: number;
    delay_unit: number;
    delay_time: number;
    priority: number;
    status: number;
    before_script_id: number;
    after_script_id: number;
    exec_period: number[];
    task_cs: number;
    op_time: number;
    depth: number;
    acq_type: number;
    acq_content: number[];
    acq_set: number[];
    td_option: number;
    project_cs: number;
}

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;
    console.log('Worker received message:', type);

    try {
        switch (type) {
            case 'PROCESS_DATA':
                try {
                    const tasks = payload as TaskData[];
                    // 这里可以添加数据处理逻辑
                    console.log('Processing data, count:', tasks.length);
                    self.postMessage({ type: 'DATA_PROCESSED', payload: tasks });
                } catch (processError: unknown) {
                    console.error('Data processing failed:', processError);
                    throw new Error(`数据处理失败: ${processError instanceof Error ? processError.message : String(processError)}`);
                }
                break;

            default:
                throw new Error(`未知的操作类型: ${type}`);
        }
    } catch (error) {
        console.error('Worker error:', error);
        self.postMessage({
            type: 'ERROR',
            payload: error instanceof Error ? error.message : '操作失败'
        });
    }
}; 
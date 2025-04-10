import ExcelJS from 'exceljs';

interface ExtractedData {
  id: string;
  frameDomain?: string;
  da?: string;
  di?: string;
  content?: string;
  time?: string;
  data?: string;
  description?: string;
  level?: number;
  children?: ExtractedData[];
}

interface ExcelWorkerData {
  rows: ExtractedData[];
  includeChildren: boolean;
}

// 格式化子项数据
const formatChildItems = (
  items: ExtractedData[],
  parentPrefix = '',
  rowData: any[] = [],
  depth = 0
): any[] => {
  items.forEach((item, index) => {
    const prefix = parentPrefix ? `${parentPrefix}-${index + 1}` : `${index + 1}`;
    
    // 添加当前项
    rowData.push({
      测量点: item.da || '',
      数据标识: item.di || '',
      内容: item.content || '',
      时间: item.time || '',
      描述: item.description || '',
    });

    // 处理子项
    if (item.children && item.children.length > 0) {
      formatChildItems(item.children, prefix, rowData, depth + 1);
    }
  });

  return rowData;
};

// 准备Excel数据
const prepareExcelData = (items: ExtractedData[], includeChildren: boolean): any[] => {
  if (!items || items.length === 0) {
    return [];
  }

  let allRows: any[] = [];

  // 第一级数据
  items.forEach((item, index) => {
    // 如果需要包含子项且有子项数据
    let description = ""
    if (includeChildren && item.children && item.children.length > 0) {
      item.children.forEach(element => {
        const child = element.description + "\n";
        description += child
      });
    }
    // 添加主项
    allRows.push({
      测量点: item.da || '',
      数据标识: item.di || '',
      内容: item.content || '',
      时间: item.time || '',
      描述: description,
    });
  });

  return allRows;
};

// 生成Excel文件
const generateExcelFile = async (data: any[]): Promise<Uint8Array> => {
  try {
    // 创建工作簿
    const workbook = new ExcelJS.Workbook();
    
    // 创建工作表
    const worksheet = workbook.addWorksheet('数据导出');
    
    // 设置列宽
    worksheet.columns = [
      { header: '测量点', key: '测量点', width: 10 },
      { header: '数据标识', key: '数据标识', width: 20 },
      { header: '内容', key: '内容', width: 30 },
      { header: '时间', key: '时间', width: 20 },
      { header: '描述', key: '描述', width: 100 }
    ];

    // 设置表头样式
    const headerRow = worksheet.getRow(1);
    headerRow.font = { 
      bold: true,
      size: 12
    };
    headerRow.alignment = { 
      vertical: 'middle', 
      horizontal: 'center' 
    };
    // 设置表头行高
    headerRow.height = 30;

    // 添加数据
    data.forEach(row => {
      const newRow = worksheet.addRow(row);
      // 设置单元格垂直居中对齐
      newRow.alignment = { 
        vertical: 'middle', 
        horizontal: 'center' 
      };
    });

    // 设置所有单元格自动换行
    worksheet.eachRow(row => {
      row.eachCell(cell => {
        cell.alignment = { 
          ...cell.alignment,
          wrapText: true 
        };
      });
    });

    // 生成Excel文件
    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    console.error('生成Excel文件错误:', error);
    throw new Error('生成Excel文件失败');
  }
};

// 处理主线程发来的消息
self.onmessage = async (event: MessageEvent<ExcelWorkerData>) => {
  try {
    const { rows, includeChildren } = event.data;
    
    // 准备数据
    const excelData = prepareExcelData(rows, includeChildren);
    
    // 生成Excel文件
    const excelFile = await generateExcelFile(excelData);
    
    // 发送结果回主线程
    self.postMessage({ 
      success: true, 
      data: excelFile 
    });
  } catch (error) {
    // 发送错误信息回主线程
    self.postMessage({ 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    });
  }
};

// 声明Worker类型
export type {}; 
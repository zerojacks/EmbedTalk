# EmbedTalk

EmbedTalk 是一款基于 Tauri + React 开发的嵌入式通信调试工具。它提供了直观的用户界面和强大的功能，帮助开发者进行串口通信调试和数据分析。

[中文文档](README_CN.md)

## ✨ 特性

- 🌈 现代化的用户界面，采用 Tailwind CSS 和 DaisyUI
- 🔌 多协议支持
- 📊 实时数据分析
- 🎨 自定义主题
- ⌨️ 全局快捷键
- 📝 历史记录管理
- 🔍 智能数据解析

## 🖥 环境要求

- Node.js (v18 或更高版本)
- Rust (最新稳定版)
- pnpm (推荐)
- Visual Studio (Windows) 或 Xcode (macOS)

## 📦 安装

1. 克隆仓库
```bash
git clone https://github.com/zerojacks/EmbedTalk.git
cd EmbedTalk
```

2. 安装依赖
```bash
pnpm install
```

3. 安装 Rust 依赖
```bash
cd src-tauri
cargo install
```

## 🚀 开发

1. 启动开发服务器
```bash
pnpm tauri dev
```

2. 构建应用
```bash
pnpm tauri build
```

## 🛠 项目结构

```
embedtalk/
├── src/                    # React 源代码
│   ├── components/         # 可复用组件
│   ├── context/           # React Context
│   ├── hooks/             # 自定义 Hooks
│   ├── routes/            # 路由组件
│   └── settingcomplent/   # 设置组件
├── src-tauri/             # Rust 后端代码
│   ├── src/               # Rust 源代码
│   └── Cargo.toml         # Rust 依赖配置
└── public/                # 静态资源
```

## 🔧 配置

### 主题配置
可以在设置中选择多种预设主题，或自定义主题颜色。

### 快捷键配置
支持自定义全局快捷键，方便快速操作。

## 📋 协议配置说明

EmbedTalk 使用 XML 文件来定义通信协议的数据项结构。以下是协议配置文件的详细说明：

### XML 文件结构

```xml
<config>
    <dataItem id="IDENTIFIER" protocol="PROTOCOL_NAME" region="REGION">
        <n>数据项名称</n>
        <length>数据长度</length>
        <unit>单位</unit>          <!-- 可选 -->
        <decimal>小数位数</decimal>  <!-- 可选 -->
        
        <!-- 子数据项 -->
        <dataItem id="SUB_ID">
            <n>子数据项名称</n>
            <length>子数据长度</length>
            <unit>单位</unit>      <!-- 可选 -->
            <decimal>小数位数</decimal>  <!-- 可选 -->
        </dataItem>
        
        <!-- 分割数据项 -->
        <splitByLength>          <!-- 可选，用于需要分割的数据 -->
            <n>分割后数据项名称</n>
            <!-- 其他属性 -->
        </splitByLength>
    </dataItem>
</config>
```

### XML 元素详解

#### 1. 父元素

##### `<dataItem>`
- **属性:**
  - `id`: 数据项的唯一标识符
  - `protocol`: 指定使用的通信协议
  - `region`: 表示数据项所属的省份

- **示例:**
```xml
<dataItem id="E1800023" protocol="csg13" region="南网">
  <name>拓扑关系详细信息</name>
  <length>unknown</length>
  <splitByLength>
    <name>总记录条数</name>
    <length>1</length>
    <type>BIN</type>
  </splitByLength>
  <!-- 其他子元素 -->
</dataItem>
```

##### `<template>`
- **属性:**
  - `id`: 模板的唯一标识符
  - `protocol`: 指定使用的通信协议
  - `region`: 表示数据项所属的省份

- **示例:**
```xml
<template id="ARD1" protocol="csg13" region="南网">
  <splitByLength>
    <name>告警状态</name>
    <length>1</length>
    <value key="00">恢复</value>
    <value key="01">发生</value>
  </splitByLength>
  <!-- 其他子元素 -->
</template>
```

#### 2. 公共子元素

- `<name>`: 描述数据项的名称
- `<length>`: 指定数据项的长度（变长时填写 `unknown`）
- `<unit>`: 数据项单位
- `<decimal>`: 数据项的小数位（可选）
- `<sign>`: 指定数据可以具有符号（yes/no，可选）
- `<type>`: 指定数据项的数据类型
  - 内置类型：`BIN`, `BCD`, `ASCII`, `NORMAL`, `PN`, `IPWITHPORT`, `FRAME645`, `ITEM`, `CSG13`
  - `NORMAL`: 直接格式化为字符串
  - `PN`: 测量点
  - `IPWITHPORT`: IP地址+端口
  - `FRAME645`: 645协议报文
  - `ITEM`: 自定义数据项
  - `CSG13`: 南网13协议报文

#### 3. 特殊子元素

##### `<splitByLength>`
- 表示数据项内容按照长度拆分
- **必需子元素:**
  - `<name>`: 描述数据项的名称
  - `<length>`: 指定数据项的长度

##### `<time>`
- 表示数据的时间格式
- 支持格式：
  - `CC`: 世纪
  - `YY`: 年
  - `MM`: 月
  - `DD`: 日
  - `WW`: 周
  - `HH`: 时
  - `mm`: 分
  - `ss`: 秒

##### `<lengthrule>`
- 指定数据项的长度规则
- 用于变长数据项
- **示例:**
```xml
<splitByLength>
    <name>应答的台区节点总数量</name>
    <length>2</length>
    <type>BCD</type>
</splitByLength>
<splitByLength>
    <name>台区识别结果</name>
    <length>unknown</length>
    <lengthrule>7 * 应答的台区节点总数量</lengthrule>
    <type>IDENTIFICATION_RESULTS</type>
</splitByLength>
```

##### `<splitbit>`
- 用于按照字节拆分每一个bit位
- **示例:**
```xml
<dataItem id="04000503">
    <name>运行状态字3</name>
    <length>2</length>
    <splitbit>
        <bit id="0">
            <name>当前运行时段</name>
            <value key="1">第二套</value>
            <value key="0">第一套</value>
        </bit>
        <!-- 其他bit定义 -->
    </splitbit>
</dataItem>
```

### 数据类型说明

#### 1. 基本属性

- `id`: 数据标识符，通常为16进制格式
- `protocol`: 协议名称（如 "csg13"）
- `region`: 使用区域（如 "南网"）
- `n`: 数据项的中文名称
- `length`: 数据长度（字节数）

#### 2. 可选属性

- `unit`: 数据单位（如 "kWh", "kvarh" 等）
- `decimal`: 小数点位数
- `splitByLength`: 用于需要按长度分割的复合数据

### 数据项类型

#### 1. 数据块

- 包含多个子数据项的集合
- 通常以 "FF00" 结尾的标识符
- 例如：`0000FF00`（组合有功电能数据块）

#### 2. 基础数据项

- 单一数据项
- 包含具体的数值信息
- 例如：`00000000`（组合有功总电能）

#### 3. 费率数据项

- 特定费率相关的数据
- 按费率号码递增
- 例如：`00000100`（费率1电能）

### 数据类型说明

#### 1. 电能数据块

- 组合有功电能 (`0000FF00`)
- 正向有功电能 (`0001FF00`)
- 反向有功电能 (`0002FF00`)
- 组合无功1电能 (`0003FF00`)
- 组合无功2电能 (`0004FF00`)
- 第一象限无功电能 (`0005FF00`)
- 第二象限无功电能 (`0006FF00`)
- 第三象限无功电能 (`0007FF00`)
- 第四象限无功电能 (`0008FF00`)
- 正向视在电能 (`0009FF00`)
- 反向视在电能 (`000AFF00`)

#### 2. 最大需量数据块

- 正向有功最大需量 (`0101FF00`)
- 反向有功最大需量 (`0102FF00`)

### 特殊数据项说明

#### 1. 费率数据项

- 每个数据块的第一个子项通常是费率数
- 费率数决定了后续费率数据项的数量
- 费率数据项长度通常为4字节

#### 2. 复合数据项

- 使用 `splitByLength` 标签的数据项
- 通常包含数值和时间信息
- 例如：最大需量及发生时间

### 数据解析规则

#### 1. 长度计算

- 数据块总长度 = 1(费率数) + 4(总电能) + 4 × N(费率电能)
- 其中 N 为费率数，最大可达61

#### 2. 数值转换

- 根据 `decimal` 属性确定小数点位置
- 根据 `unit` 属性显示对应单位
- 数值通常采用 BCD 码格式存储

### 使用建议

#### 1. 协议扩展

- 在 `src-tauri/resources/protocolconfig/` 目录下创建新的协议文件
- 遵循现有的 XML 结构定义新的数据项
- 确保 ID 不与现有协议冲突

#### 2. 数据验证

- 检查数据块长度是否符合定义
- 验证费率数与实际数据项数量是否匹配
- 确保必要的属性（如单位、小数位）已正确设置

### 示例说明

```xml
<dataItem id="0000FF00" protocol="csg13" region="南网">
    <n>(当前)组合有功电能数据块</n>
    <length>257</length>
    <dataItem id="费率数">
        <n>费率数</n>
        <length>1</length>
    </dataItem>
    <dataItem id="00000000">
        <n>(当前)组合有功总电能</n>
        <length>4</length>
        <unit>kWh</unit>
        <decimal>2</decimal>
    </dataItem>
</dataItem>
```

这个示例定义了：
- 一个组合有功电能数据块
- 包含费率数（1字节）和总电能（4字节）
- 总电能的单位是 kWh，保留2位小数

### 注意事项

#### 1. 数据项ID的规则：

- 前4位：数据类型标识
- 中间2位：费率号（00-3D）
- 后2位：保留位

#### 2. 数据长度：

- 必须明确指定每个数据项的长度
- 父数据项的长度包含所有子数据项的长度总和

#### 3. 单位和小数位：

- 对于需要显示的数值，应指定单位和小数位
- 常用单位：kWh（电能）、kvarh（无功电能）、kVAh（视在电能）

## 📝 开发指南

### 添加新功能
1. 在 `src/components` 中创建新组件
2. 在 `src-tauri/src` 中添加对应的后端功能
3. 在 `src/routes` 中整合前端组件

### 调试
- 使用 `console.log` 进行前端调试
- 使用 `println!` 或 `tracing` 进行后端调试
- 可以通过 DevTools 查看网络请求和组件状态

## 🤝 贡献

欢迎提交 Pull Request 或创建 Issue！

## 📄 许可证

[MIT License](LICENSE)

## 🙏 鸣谢

- [Tauri](https://tauri.app/)
- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [DaisyUI](https://daisyui.com/)

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- Issue : [zerojacks/EmbedTalk/issues](https://github.com/zerojacks/EmbedTalk/issues)
- 邮箱：[zerojack.shi@gmail.com](mailto:zerojack.shi@gmail.com)
- GitHub：[\[zerojacks](https://github.com/zerojacks)]

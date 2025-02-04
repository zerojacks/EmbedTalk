# EmbedTalk

EmbedTalk is an embedded communication debugging tool developed with Tauri + React. It provides an intuitive user interface and powerful features to help developers debug serial communication and analyze data.

[中文文档](README_CN.md)

## ✨ Features

- 🌈 Modern user interface with Tailwind CSS and DaisyUI
- 🔌 Multi-protocol support
- 📊 Real-time data analysis
- 🎨 Customizable themes
- ⌨️ Global shortcuts
- 📝 History management
- 🔍 Smart data parsing

## 🖥 Prerequisites

- Node.js (v18 or higher)
- Rust (latest stable version)
- pnpm (recommended)
- Visual Studio (Windows) or Xcode (macOS)

## 📦 Installation

1. Clone the repository
```bash
git clone https://github.com/zerojacks/EmbedTalk.git
cd EmbedTalk
```

2. Install dependencies
```bash
pnpm install
```

3. Install Rust dependencies
```bash
cd src-tauri
cargo install
```

## 🚀 Development

1. Start the development server
```bash
pnpm tauri dev
```

2. Build the application
```bash
pnpm tauri build
```

## 🛠 Project Structure

```
embedtalk/
├── src/                    # React source code
│   ├── components/         # Reusable components
│   ├── context/           # React Context
│   ├── hooks/             # Custom Hooks
│   ├── routes/            # Route components
│   └── settingcomplent/   # Setting components
├── src-tauri/             # Rust backend code
│   ├── src/               # Rust source code
│   └── Cargo.toml         # Rust dependencies
└── public/                # Static assets
```

## 🔧 Configuration

### Theme Configuration
Multiple preset themes are available in settings, or customize your own theme colors.

### Shortcut Configuration
Supports custom global shortcuts for quick operations.

## 📋 Protocol Configuration

EmbedTalk uses XML files to define the data item structure of communication protocols. Here's a detailed explanation of the protocol configuration file:

### XML File Structure

```xml
<config>
    <dataItem id="IDENTIFIER" protocol="PROTOCOL_NAME" region="REGION">
        <name>Data Item Name</name>
        <length>Data Length</length>
        <unit>Unit</unit>          <!-- Optional -->
        <decimal>Decimal Places</decimal>  <!-- Optional -->
        
        <!-- Sub Data Item -->
        <dataItem id="SUB_ID">
            <name>Sub Data Item Name</name>
            <length>Sub Data Length</length>
            <unit>Unit</unit>      <!-- Optional -->
            <decimal>Decimal Places</decimal>  <!-- Optional -->
        </dataItem>
        
        <!-- Split Data Item -->
        <splitByLength>          <!-- Optional, for data that needs to be split -->
            <name>Split Data Item Name</name>
            <!-- Other attributes -->
        </splitByLength>
    </dataItem>
</config>
```

### XML Elements in Detail

#### 1. Parent Elements

##### `<dataItem>`
- **Attributes:**
  - `id`: Unique identifier for the data item
  - `protocol`: Specifies the communication protocol
  - `region`: Indicates the region where the data item is used

- **Example:**
```xml
<dataItem id="E1800023" protocol="csg13" region="Southern Grid">
  <name>Topology Relationship Details</name>
  <length>unknown</length>
  <splitByLength>
    <name>Total Record Count</name>
    <length>1</length>
    <type>BIN</type>
  </splitByLength>
  <!-- Other sub-elements -->
</dataItem>
```

##### `<template>`
- **Attributes:**
  - `id`: Unique identifier for the template
  - `protocol`: Specifies the communication protocol
  - `region`: Indicates the region where the template is used

- **Example:**
```xml
<template id="ARD1" protocol="csg13" region="Southern Grid">
  <splitByLength>
    <name>Alarm Status</name>
    <length>1</length>
    <value key="00">Restored</value>
    <value key="01">Occurred</value>
  </splitByLength>
  <!-- Other sub-elements -->
</template>
```

#### 2. Common Sub-elements

- `<name>`: Describes the name of the data item
- `<length>`: Specifies the length of the data item (use `unknown` for variable length)
- `<unit>`: Unit of the data item
- `<decimal>`: Decimal places of the data item (optional)
- `<sign>`: Specifies if the data can have a sign (yes/no, optional)
- `<type>`: Specifies the data type
  - Built-in types: `BIN`, `BCD`, `ASCII`, `NORMAL`, `PN`, `IPWITHPORT`, `FRAME645`, `ITEM`, `CSG13`
  - `NORMAL`: Format directly as string
  - `PN`: Measuring point
  - `IPWITHPORT`: IP address + port
  - `FRAME645`: 645 protocol frame
  - `ITEM`: Custom data item
  - `CSG13`: Southern Grid 13 protocol frame

#### 3. Special Sub-elements

##### `<splitByLength>`
- Indicates content split by length
- **Required sub-elements:**
  - `<name>`: Describes the name of the data item
  - `<length>`: Specifies the length of the data item

##### `<time>`
- Represents time format
- Supported formats:
  - `CC`: Century
  - `YY`: Year
  - `MM`: Month
  - `DD`: Day
  - `WW`: Week
  - `HH`: Hour
  - `mm`: Minute
  - `ss`: Second

##### `<lengthrule>`
- Specifies length rules for data items
- Used for variable-length data items
- **Example:**
```xml
<splitByLength>
    <name>Total Node Count Response</name>
    <length>2</length>
    <type>BCD</type>
</splitByLength>
<splitByLength>
    <name>Area Identification Results</name>
    <length>unknown</length>
    <lengthrule>7 * Total Node Count Response</lengthrule>
    <type>IDENTIFICATION_RESULTS</type>
</splitByLength>
```

##### `<splitbit>`
- Used to split bytes into individual bits
- **Example:**
```xml
<dataItem id="04000503">
    <name>Running Status Word 3</name>
    <length>2</length>
    <splitbit>
        <bit id="0">
            <name>Current Running Period</name>
            <value key="1">Second Set</value>
            <value key="0">First Set</value>
        </bit>
        <!-- Other bit definitions -->
    </splitbit>
</dataItem>
```

### Data Type Details

1. **Data Blocks**
   - Collection of multiple sub-items
   - Identifiers typically end with "FF00"
   - Example: `0000FF00` (Combined Active Energy Data Block)

2. **Basic Data Items**
   - Single data items
   - Contains specific value information
   - Example: `00000000` (Combined Total Active Energy)

3. **Rate Data Items**
   - Data related to specific rates
   - Incremental by rate number
   - Example: `00000100` (Rate 1 Energy)

### Data Item Types

1. **Energy Data Blocks**
   - Combined Active Energy (`0000FF00`)
   - Forward Active Energy (`0001FF00`)
   - Reverse Active Energy (`0002FF00`)
   - Combined Reactive Energy 1 (`0003FF00`)
   - Combined Reactive Energy 2 (`0004FF00`)
   - Quadrant 1 Reactive Energy (`0005FF00`)
   - Quadrant 2 Reactive Energy (`0006FF00`)
   - Quadrant 3 Reactive Energy (`0007FF00`)
   - Quadrant 4 Reactive Energy (`0008FF00`)
   - Forward Apparent Energy (`0009FF00`)
   - Reverse Apparent Energy (`000AFF00`)

2. **Maximum Demand Data Blocks**
   - Forward Active Maximum Demand (`0101FF00`)
   - Reverse Active Maximum Demand (`0102FF00`)

### Special Data Items

1. **Rate Data Items**
   - First sub-item in each block is typically the rate count
   - Rate count determines the number of subsequent rate data items
   - Rate data items are typically 4 bytes in length

2. **Composite Data Items**
   - Uses the `splitByLength` tag
   - Usually contains value and timestamp information
   - Example: Maximum demand and occurrence time

### Data Parsing Rules

1. **Length Calculation**
   - Data block total length = 1(rate count) + 4(total energy) + 4 × N(rate energy)
   - Where N is the rate count, maximum up to 61

2. **Value Conversion**
   - Decimal point position determined by `decimal` attribute
   - Units displayed according to `unit` attribute
   - Values typically stored in BCD format

### Usage Guidelines

1. **Protocol Extension**
   - Create new protocol files in `src-tauri/resources/protocolconfig/` directory
   - Follow existing XML structure for new data items
   - Ensure IDs don't conflict with existing protocols

2. **Data Validation**
   - Check if data block length matches definition
   - Verify rate count matches actual number of data items
   - Ensure required attributes (units, decimals) are properly set

### Example

```xml
<dataItem id="0000FF00" protocol="csg13" region="Southern Grid">
    <name>(Current) Combined Active Energy Data Block</name>
    <length>257</length>
    <dataItem id="RateCount">
        <name>Rate Count</name>
        <length>1</length>
    </dataItem>
    <dataItem id="00000000">
        <name>(Current) Combined Total Active Energy</name>
        <length>4</length>
        <unit>kWh</unit>
        <decimal>2</decimal>
    </dataItem>
</dataItem>
```

This example defines:
- A combined active energy data block
- Contains rate count (1 byte) and total energy (4 bytes)
- Total energy unit is kWh with 2 decimal places

### Important Notes

1. Data Item ID Rules:
   - First 4 digits: Data type identifier
   - Middle 2 digits: Rate number (00-3D)
   - Last 2 digits: Reserved
   
2. Data Length:
   - Must specify length for each data item
   - Parent item length includes sum of all child item lengths

3. Units and Decimals:
   - Specify units and decimal places for displayable values
   - Common units: kWh (Energy), kvarh (Reactive Energy), kVAh (Apparent Energy)

## 📝 Development Guide

### Adding New Features
1. Create new components in `src/components`
2. Add corresponding backend functionality in `src-tauri/src`
3. Integrate frontend components in `src/routes`

### Debugging
- Use `console.log` for frontend debugging
- Use `println!` or `tracing` for backend debugging
- Check network requests and component states through DevTools

## 🤝 Contributing

Pull requests and issues are welcome!

## 📄 License

[MIT License](LICENSE)

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/)
- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [DaisyUI](https://daisyui.com/)

## 📞 Contact

For questions or suggestions, please contact through:

- Issue : [zerojacks/EmbedTalk/issues](https://github.com/zerojacks/EmbedTalk/issues)
- Email: [zerojack.shi@gmail.com](mailto:zerojack.shi@gmail.com)
- GitHub：[\[zerojacks](https://github.com/zerojacks)]


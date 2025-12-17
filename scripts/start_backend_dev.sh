#!/usr/bin/env bash
set -euo pipefail

echo "🚀 启动开发环境后端服务器..."

# 检查 Rust 是否安装
if ! command -v cargo >/dev/null 2>&1; then
    echo "❌ 错误: 未找到 Rust/Cargo，请先安装 Rust"
    exit 1
fi

# 进入项目目录
cd "$(dirname "$0")/.."

# 设置环境变量
export HOST=127.0.0.1
export PORT=3000
export RUST_LOG=info

echo "📦 构建并启动后端服务器..."
echo "🌐 服务地址: http://localhost:3000"
echo "💚 健康检查: http://localhost:3000/health"
echo "📋 按 Ctrl+C 停止服务"
echo ""

# 构建并运行（Web 模式）
cargo run --features web --no-default-features --manifest-path src-tauri/Cargo.toml
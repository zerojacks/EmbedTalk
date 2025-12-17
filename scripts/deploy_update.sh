#!/bin/bash

# EmbedTalk 更新部署脚本
# 使用方法: ./deploy_update.sh

set -e

# 配置变量
DOMAIN="embedtools.icu"
PROJECT_DIR="/opt/embedtools"
WEB_ROOT="/var/www/embedtools"
SERVICE_NAME="embedtools-backend"

echo "🔄 开始更新 EmbedTalk..."

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 root 用户运行此脚本"
    exit 1
fi

# 进入项目目录
cd $PROJECT_DIR

# 备份当前版本
echo "💾 备份当前版本..."
BACKUP_DIR="/opt/embedtools-backup-$(date +%Y%m%d-%H%M%S)"
cp -r $PROJECT_DIR $BACKUP_DIR
echo "✅ 备份保存到: $BACKUP_DIR"

# 更新代码
echo "📥 拉取最新代码..."
git fetch origin
git reset --hard origin/main

# 停止后端服务
echo "⏹️ 停止后端服务..."
systemctl stop $SERVICE_NAME

# 构建前端
echo "🏗️ 构建前端..."
export VITE_WEB_API_BASE="https://$DOMAIN"
pnpm install
pnpm run build

# 更新前端文件
echo "📋 更新前端文件..."
rm -rf $WEB_ROOT/*
cp -r dist/* $WEB_ROOT/
chown -R www-data:www-data $WEB_ROOT

# 构建后端
echo "🏗️ 构建后端..."
cd src-tauri
cargo build --release --features web

# 启动后端服务
echo "🚀 启动后端服务..."
systemctl start $SERVICE_NAME

# 重载 Nginx 配置
echo "🔄 重载 Nginx 配置..."
nginx -t && systemctl reload nginx

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "✅ 检查服务状态..."
if systemctl is-active --quiet $SERVICE_NAME; then
    echo "✅ 后端服务运行正常"
else
    echo "❌ 后端服务启动失败"
    echo "📋 查看日志: journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi

# 测试部署
echo "🧪 测试部署..."
if curl -f -s https://$DOMAIN/health > /dev/null; then
    echo "✅ 后端健康检查通过"
else
    echo "❌ 后端健康检查失败"
    echo "🔄 尝试回滚到备份版本..."
    systemctl stop $SERVICE_NAME
    rm -rf $PROJECT_DIR
    mv $BACKUP_DIR $PROJECT_DIR
    cd $PROJECT_DIR/src-tauri
    systemctl start $SERVICE_NAME
    exit 1
fi

if curl -f -s https://$DOMAIN > /dev/null; then
    echo "✅ 前端访问正常"
else
    echo "❌ 前端访问失败"
fi

# 清理旧备份 (保留最近 5 个)
echo "🧹 清理旧备份..."
ls -dt /opt/embedtools-backup-* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true

echo ""
echo "🎉 更新完成!"
echo "🌐 网站地址: https://$DOMAIN"
echo "💾 备份位置: $BACKUP_DIR"
echo ""
echo "📋 如有问题，可以回滚:"
echo "  systemctl stop $SERVICE_NAME"
echo "  rm -rf $PROJECT_DIR"
echo "  mv $BACKUP_DIR $PROJECT_DIR"
echo "  systemctl start $SERVICE_NAME"
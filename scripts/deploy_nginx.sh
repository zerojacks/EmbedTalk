#!/bin/bash

# EmbedTalk Nginx 部署脚本
# 使用方法: ./deploy_nginx.sh [domain] [email]

set -e

# 配置变量
DOMAIN=${1:-"embedtools.icu"}
EMAIL=${2:-"admin@embedtools.icu"}
PROJECT_DIR="/opt/embedtools"
WEB_ROOT="/var/www/embedtools"
NGINX_CONFIG="/etc/nginx/sites-available/embedtools"
SERVICE_NAME="embedtools-backend"

echo "🚀 开始部署 EmbedTalk 到 $DOMAIN"

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 root 用户运行此脚本"
    exit 1
fi

# 更新系统
echo "📦 更新系统包..."
apt update && apt upgrade -y

# 安装必要软件
echo "📦 安装必要软件..."
apt install -y nginx certbot python3-certbot-nginx curl wget git build-essential

# 安装 Node.js (如果未安装)
if ! command -v node &> /dev/null; then
    echo "📦 安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi

# 安装 pnpm (如果未安装)
if ! command -v pnpm &> /dev/null; then
    echo "📦 安装 pnpm..."
    npm install -g pnpm
fi

# 安装 Rust (如果未安装)
if ! command -v cargo &> /dev/null; then
    echo "📦 安装 Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source ~/.cargo/env
fi

# 创建项目目录
echo "📁 创建项目目录..."
mkdir -p $PROJECT_DIR
mkdir -p $WEB_ROOT

# 克隆或更新项目代码
if [ -d "$PROJECT_DIR/.git" ]; then
    echo "🔄 更新项目代码..."
    cd $PROJECT_DIR
    git pull origin main
else
    echo "📥 克隆项目代码..."
    git clone https://github.com/your-username/embedtalk.git $PROJECT_DIR
    cd $PROJECT_DIR
fi

# 构建前端
echo "🏗️ 构建前端..."
export VITE_WEB_API_BASE="https://$DOMAIN"
pnpm install
pnpm run build

# 复制前端文件到 web 根目录
echo "📋 部署前端文件..."
cp -r dist/* $WEB_ROOT/
chown -R www-data:www-data $WEB_ROOT

# 构建后端
echo "🏗️ 构建后端..."
cd src-tauri
cargo build --release --features web

# 创建后端服务
echo "🔧 创建后端服务..."
cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=EmbedTalk Backend Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$PROJECT_DIR/src-tauri
ExecStart=$PROJECT_DIR/src-tauri/target/release/embedtalk
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=RUST_LOG=info
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 配置 Nginx
echo "🔧 配置 Nginx..."
cp deploy/nginx.conf $NGINX_CONFIG

# 更新 nginx 配置中的域名
sed -i "s/embedtools\.icu/$DOMAIN/g" $NGINX_CONFIG

# 启用站点
ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试 Nginx 配置
nginx -t

# 启动服务
echo "🚀 启动服务..."
systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME
systemctl enable nginx
systemctl restart nginx

# 申请 SSL 证书
echo "🔒 申请 SSL 证书..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive --redirect

# 设置证书自动续期
echo "⏰ 设置证书自动续期..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

# 配置防火墙
echo "🔥 配置防火墙..."
ufw allow 'Nginx Full'
ufw allow ssh
ufw --force enable

# 检查服务状态
echo "✅ 检查服务状态..."
systemctl status $SERVICE_NAME --no-pager
systemctl status nginx --no-pager

# 测试部署
echo "🧪 测试部署..."
sleep 5
if curl -f -s https://$DOMAIN/health > /dev/null; then
    echo "✅ 后端健康检查通过"
else
    echo "❌ 后端健康检查失败"
fi

if curl -f -s https://$DOMAIN > /dev/null; then
    echo "✅ 前端访问正常"
else
    echo "❌ 前端访问失败"
fi

echo ""
echo "🎉 部署完成!"
echo "🌐 网站地址: https://$DOMAIN"
echo "🔍 健康检查: https://$DOMAIN/health"
echo ""
echo "📋 常用命令:"
echo "  查看后端日志: journalctl -u $SERVICE_NAME -f"
echo "  查看 Nginx 日志: tail -f /var/log/nginx/embedtools_*.log"
echo "  重启后端: systemctl restart $SERVICE_NAME"
echo "  重启 Nginx: systemctl restart nginx"
echo "  更新证书: certbot renew"
echo ""
echo "🔧 如需更新代码，请运行: ./deploy_update.sh"
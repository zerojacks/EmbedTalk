#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root"
  exit 1
fi

APP_NAME="EmbedTalk"
SERVICE_NAME="embedtalk-web.service"
INSTALL_DIR="${INSTALL_DIR:-/opt/embedtalk-web}"
REPO_DIR="${REPO_DIR:-$(pwd)}"
PORT="${PORT:-3000}"
BIND_ADDR="${BIND_ADDR:-0.0.0.0}"

if ! command -v cargo >/dev/null 2>&1; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
  source "$HOME/.cargo/env"
fi

mkdir -p "$INSTALL_DIR"
cd "$REPO_DIR/src-tauri"
cargo build --release --no-default-features --features web
cp -f "$REPO_DIR/src-tauri/target/release/$APP_NAME" "$INSTALL_DIR/$APP_NAME"

cat > "/etc/systemd/system/$SERVICE_NAME" <<EOF
[Unit]
Description=EmbedTalk Web Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
Environment=WEB_SERVER_ADDR=$BIND_ADDR:$PORT
ExecStart=$INSTALL_DIR/$APP_NAME
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

if command -v ufw >/dev/null 2>&1; then
  ufw allow "$PORT"/tcp || true
fi

systemctl status "$SERVICE_NAME" --no-pager || true
echo "Service $SERVICE_NAME started on $BIND_ADDR:$PORT"

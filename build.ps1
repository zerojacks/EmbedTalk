# 设置私钥环境变量
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Path ".\tauri-key.pem" -Raw

# 设置密码环境变量
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "embedtalk"

# 构建应用
pnpm tauri build

# 清除环境变量
$env:TAURI_SIGNING_PRIVATE_KEY = $null
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $null

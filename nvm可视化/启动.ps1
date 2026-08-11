Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Pause-Exit([int]$Code = 1) {
  Write-Host ''
  Read-Host '按回车键退出'
  exit $Code
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '[错误] 未检测到 Node.js。'
  Write-Host '正在打开 nvm-windows 下载页面…'
  Start-Process 'https://github.com/coreybutler/nvm-windows/releases/latest'
  Pause-Exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\electron'))) {
  Write-Host '首次运行，正在安装依赖…'
  $env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[错误] 依赖安装失败'
    Pause-Exit 1
  }
}

Write-Host '正在启动 NVM 可视化管理…'
npm start
if ($LASTEXITCODE -ne 0) {
  Write-Host '[错误] 启动失败'
  Pause-Exit 1
}

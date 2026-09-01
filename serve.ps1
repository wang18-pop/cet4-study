param([int]$Port = 8000)

$root = Split-Path $PSScriptRoot -Parent
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command py -ErrorAction SilentlyContinue }
if (-not $python) {
  Write-Error "未找到 Python。请安装 Python 后重试，或改用任意静态文件服务器打开本目录。"
  exit 1
}

Write-Host "本地预览已启动: http://127.0.0.1:$Port （按 Ctrl+C 停止）"
& $python.Source -m http.server $Port --bind 127.0.0.1 --directory $root

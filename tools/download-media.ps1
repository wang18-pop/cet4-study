param(
  [switch]$PdfOnly,
  [switch]$AudioOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$papers = (Get-Content (Join-Path $root 'data/papers.json') -Raw -Encoding UTF8 | ConvertFrom-Json).papers
$map = @{}

foreach ($p in $papers) {
  $urls = @()
  if (-not $AudioOnly) { $urls += $p.pdfUrl }
  if ($p.audioUrl -and -not $PdfOnly) { $urls += $p.audioUrl }

  foreach ($url in $urls) {
    $rel = 'media/' + ($url -replace '^https://cdn\.jsdelivr\.net/gh/catteacher0515/cet4-download@main/public/', '')
    $dest = Join-Path $root $rel
    $dir = Split-Path $dest -Parent
    New-Item -ItemType Directory -Force -Path $dir | Out-Null

    if (-not (Test-Path $dest)) {
      try {
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
        Write-Host "✓ $url"
      } catch {
        Write-Warning "下载失败（可稍后重试）: $url"
      }
    }
    $map[$url] = $rel
  }
}

$out = Join-Path $root 'data/media-local.json'
@{ files = $map } | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $out
Write-Host "已生成本地媒体映射: data/media-local.json"

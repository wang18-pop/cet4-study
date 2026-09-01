$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

function Fail([string]$msg) {
  Write-Host "✗ $msg" -ForegroundColor Red
  $script:failed = $true
}

$script:failed = $false
Write-Host "== 校验数据文件 ==" -ForegroundColor Cyan

Get-ChildItem (Join-Path $root 'data') -Recurse -Filter '*.json' | ForEach-Object {
  try {
    $null = Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-Host "✓ $($_.FullName.Substring($root.Length + 1))"
  } catch {
    Fail "JSON 无法解析: $($_.Name) - $($_.Exception.Message)"
  }
}

Write-Host "`n== 校验真题元数据 ==" -ForegroundColor Cyan
$papers = (Get-Content (Join-Path $root 'data/papers.json') -Raw -Encoding UTF8 | ConvertFrom-Json).papers
Write-Host "真题数量: $($papers.Count)"
foreach ($p in $papers) {
  if (-not $p.id -or -not $p.year -or -not $p.month -or -not $p.title -or -not $p.pdfUrl) {
    Fail "真题字段不完整: $($p.id)"
  }
}
$audioCount = ($papers | Where-Object { $_.audioUrl }).Count
Write-Host "含听力音频: $audioCount 套"

Write-Host "`n== 校验本地数据文件 ==" -ForegroundColor Cyan
$required = @(
  'data/practice/original-listening.json',
  'data/practice/original-reading.json',
  'data/practice/original-translation.json',
  'data/practice/original-writing.json',
  'data/vocabulary.json',
  'data/vocab-test.json',
  'data/grammar.json',
  'data/writing-templates.json'
)
foreach ($rel in $required) {
  $path = Join-Path $root $rel
  if (Test-Path $path) { Write-Host "✓ $rel" } else { Fail "缺失: $rel" }
}

if ($script:failed) {
  Write-Host "`n校验未通过。" -ForegroundColor Red
  exit 1
}
Write-Host "`n全部校验通过。" -ForegroundColor Green

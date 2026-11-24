$ErrorActionPreference = 'Continue'
$base  = 'E:\DSH-Data\projects\qorder\competition-rating-data\sweep'
$raw   = Join-Path $base 'raw'
$modsearch = 'C:\Users\h1233\.config\opencode\skills\modsearch\scripts\run.ps1'
New-Item -ItemType Directory -Force -Path $raw | Out-Null

# 已在 universities-competition-ratings.csv 中有数据的学校，跳过
$done = @(
  '南京大学','东南大学','南京航空航天大学','河海大学','浙江大学','中国科学技术大学',
  '中国农业大学','北京交通大学','中南大学','华东理工大学','西北农林科技大学',
  '南京工业大学','武汉科技大学','江苏科技大学','武汉工程大学','上海工程技术大学'
)

$schools = @()
foreach ($f in @((Join-Path $base 'schools.txt'), (Join-Path $base 'schools-shuangfei.txt'))) {
  $schools += (Get-Content -Encoding UTF8 -Path $f | ConvertFrom-Csv -Delimiter '|')
}

$stats = @{ total = 0; skipped = 0; swept = 0; failed = 0 }
foreach ($s in $schools) {
  $stats.total++
  $name = $s.name
  if ($done -contains $name) { $stats.skipped++; continue }

  $safe = $name -replace '[（）()]', ''
  $j1 = Join-Path $raw "$safe.q1.json"
  $j2 = Join-Path $raw "$safe.q2.json"

  # 断点续跑：已有完整 JSON 的学校跳过
  if ((Test-Path $j1) -and (Test-Path $j2)) { $stats.swept++; continue }

  if (-not (Test-Path $j1)) {
    & $modsearch -q "$name 学科竞赛 分级目录 A类 B类 管理办法" -o $j1 *> (Join-Path $raw "$safe.q1.log")
  }
  if (-not (Test-Path $j2)) {
    & $modsearch -q "$name 大学生竞赛 等级认定 通知" -o $j2 *> (Join-Path $raw "$safe.q2.log")
  }

  $ok1 = Test-Path $j1; $ok2 = Test-Path $j2
  if ($ok1 -and $ok2) {
    $stats.swept++
    Remove-Item (Join-Path $raw "$safe.q*.log") -ErrorAction SilentlyContinue
    Write-Output "$name OK"
  } else {
    $stats.failed++
    Write-Output "$name FAIL q1=$ok1 q2=$ok2 (log 保留)"
  }
}
Write-Output "===== 汇总：名单总计=$($stats.total) 已有数据跳过=$($stats.skipped) 本次完成=$($stats.swept) 失败=$($stats.failed) ====="

# 上线验收（2026-11-03 第三次修订）
#
# 目标：确认「只上作品集、胶片档案不上线」这个状态真的生效
#
# 网络事实：
#   - 直连 oceanfolio.vercel.app 超时（vercel.app 国内被污染+RST）
#   - 系统代理已关闭（ProxyEnable=0），但 127.0.0.1:7890 代理进程仍在且可用
#   => 用 curl 显式指定代理
#
# 踩过的坑：初版把首页结果存进 $home，而 HOME 是 PowerShell 只读自动变量，
# 赋值静默失败 -> 断言落空、脚本空转 27 轮。这里一律用 $pageHome。
#
# 判据（四项都满足才算通过）：
#   1. /film 返回 307/308 重定向，而不是 200   -> 胶片档案已下线
#   2. /film/roll-017 同样重定向               -> 单卷页也挡掉
#   3. bundle 内含 carmen                      -> 本轮新作品已上线
#   4. bundle 内不含 film archive 入口文案      -> 首屏已摘除入口
#
# 用法：powershell -ExecutionPolicy Bypass -File verify-deploy.ps1 [-Proxy http://127.0.0.1:7890]

param(
  [string]$BaseUrl = 'https://oceanfolio.vercel.app',
  [string]$Proxy   = 'http://127.0.0.1:7890',
  [int]$TimeoutMin = 12
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$BaseUrl = $BaseUrl.TrimEnd('/')
$curl = (Get-Command curl.exe -ErrorAction SilentlyContinue).Source

function Fetch($url, $timeoutSec = 35) {
  # 不跟随重定向，直接拿状态码
  $out = & $curl -sS --max-time $timeoutSec -x $Proxy -w "`n__CODE__%{http_code}" $url 2>$null
  $text = ($out | Out-String)
  $idx = $text.LastIndexOf('__CODE__')
  if ($idx -lt 0) { return @{ status = 0; body = '' } }
  $code = $text.Substring($idx + 8).Trim()
  return @{ status = [int]$code; body = $text.Substring(0, $idx) }
}

Write-Output "代理: $Proxy   目标: $BaseUrl"
Write-Output ''

$deadline = (Get-Date).AddMinutes($TimeoutMin)
$round = 0
$snapshot = $null

while ((Get-Date) -lt $deadline) {
  $round++
  $stamp = (Get-Date).ToString('HH:mm:ss')

  $filmRoot = Fetch "$BaseUrl/film" 30
  $filmRoll = Fetch "$BaseUrl/film/roll-017" 30
  $pageHome = Fetch "$BaseUrl/" 30
  $hasCarmen = $false
  $hasFilmEntry = $false
  $chunkCount = 0

  if ($pageHome.status -eq 200 -and $pageHome.body) {
    $chunkUrls = [regex]::Matches($pageHome.body, '/_next/static/chunks/[A-Za-z0-9_./-]+\.js') |
                 ForEach-Object { $_.Value } | Select-Object -Unique
    $chunkCount = (@($chunkUrls) | Measure-Object).Count
    foreach ($c in $chunkUrls) {
      $js = Fetch "$BaseUrl$c" 35
      if ($js.status -eq 200 -and $js.body) {
        if ($js.body -match 'carmen') { $hasCarmen = $true }
        if ($js.body -match 'film archive|view all rolls') { $hasFilmEntry = $true }
      }
    }
  }

  $filmOffline = ($filmRoot.status -in 301, 302, 307, 308) -and ($filmRoll.status -in 301, 302, 307, 308)
  $snapshot = [pscustomobject]@{
    round = $round; home = $pageHome.status; film = $filmRoot.status; roll = $filmRoll.status
    chunks = $chunkCount; carmen = $hasCarmen; filmEntry = $hasFilmEntry
  }
  Write-Output ("  [{0}] 第{1}轮  首页={2}  /film={3}  /film/roll-017={4}  chunks={5}  carmen={6}  film入口={7}" -f `
      $stamp, $round, $pageHome.status, $filmRoot.status, $filmRoll.status, $chunkCount, $hasCarmen, $hasFilmEntry)

  if ($filmOffline -and $hasCarmen -and (-not $hasFilmEntry) -and $pageHome.status -eq 200) {
    Write-Output ''
    Write-Output '✅ 上线验收通过：胶片已下线（307 重定向）、作品集含 carmen、首屏无 film 入口'
    exit 0
  }
  Start-Sleep -Seconds 20
}

Write-Output ''
Write-Output ("⚠ 超时（{0} 轮）。最后：首页={1} /film={2} /film/roll-017={3} carmen={4} film入口={5}" -f `
    $snapshot.round, $snapshot.home, $snapshot.film, $snapshot.roll, $snapshot.carmen, $snapshot.filmEntry)
exit 1

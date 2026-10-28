# 国内可达性实测：Vercel 直连 vs Cloudflare 前置
#
# 目的：把"国内能不能进"变成可复核的数字 ——
#   1. 不同 DNS 解析器对 vercel.app / cname.vercel-dns.com / cloudflare.com 的解析结果
#      （若解析结果异常或为空，说明存在 DNS 污染/劫持）
#   2. 用 curl --resolve 指定 IP 直连（正确 SNI），测 TCP 连接耗时与总耗时
#      → 判断"自定义域名直连 Vercel"与"Cloudflare 边缘"两条路各自通不通
#
# 用法：powershell -ExecutionPolicy Bypass -File measure-cn-reachability.ps1
# 输出：控制台表格；同时可重定向到文件留档

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

function Section($t) { Write-Output ''; Write-Output ("=== " + $t + " ===") }

# ---------- 1. DNS ----------
Section 'DNS 解析（多解析器对比）'
$names = @('oceanfolio.vercel.app', 'cname.vercel-dns.com', 'cloudflare.com')
$resolvers = @(
  @{ label = '阿里 223.5.5.5';   ip = '223.5.5.5' },
  @{ label = 'DNSPod 119.29.29.29'; ip = '119.29.29.29' },
  @{ label = '114 114.114.114.114'; ip = '114.114.114.114' },
  @{ label = 'Google 8.8.8.8';   ip = '8.8.8.8' }
)

foreach ($n in $names) {
  Write-Output ''
  Write-Output ("--- " + $n + " ---")
  foreach ($r in $resolvers) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
      $ans = Resolve-DnsName -Name $n -Server $r.ip -Type A -DnsOnly -QuickTimeout -ErrorAction Stop |
             Where-Object { $_.IPAddress } | Select-Object -ExpandProperty IPAddress
      $sw.Stop()
      $list = if ($ans) { ($ans -join ', ') } else { '(无 A 记录)' }
      Write-Output ("{0,-22} {1,7:N0}ms  {2}" -f $r.label, $sw.Elapsed.TotalMilliseconds, $list)
    } catch {
      $sw.Stop()
      Write-Output ("{0,-22} {1,7:N0}ms  FAIL: {2}" -f $r.label, $sw.Elapsed.TotalMilliseconds, $_.Exception.Message)
    }
  }
  try {
    $sys = Resolve-DnsName -Name $n -Type A -ErrorAction Stop |
           Where-Object { $_.IPAddress } | Select-Object -ExpandProperty IPAddress
    Write-Output ("{0,-22} {1}  {2}" -f '本机默认', '', (($sys -join ', ')))
  } catch { Write-Output ("{0,-22} FAIL" -f '本机默认') }
}

# ---------- 2. 端到端 HTTP ----------
Section 'HTTP 实测（curl 指定 IP + 正确 SNI；o=连接耗时 t=总耗时）'
$curl = (Get-Command curl.exe -ErrorAction SilentlyContinue).Source
if (-not $curl) { Write-Output 'curl.exe 不存在，跳过 HTTP 实测'; exit 0 }

# (SNI 域名, 目标 IP, 说明)
$probes = New-Object System.Collections.ArrayList

# Vercel：官方 anycast 与解析结果
[void]$probes.Add(@{ sni = 'oceanfolio.vercel.app'; ip = '76.76.21.21'; note = 'Vercel anycast A（官方推荐值）' })
[void]$probes.Add(@{ sni = 'oceanfolio.vercel.app'; ip = '76.76.21.61'; note = 'Vercel anycast A（备选值）' })

# 解析到的 IP 也各测一次
foreach ($n in @('oceanfolio.vercel.app', 'cname.vercel-dns.com')) {
  try {
    $ips = Resolve-DnsName -Name $n -Type A -DnsOnly -ErrorAction Stop |
           Where-Object { $_.IPAddress } | Select-Object -ExpandProperty IPAddress -Unique
    foreach ($ip in $ips) {
      [void]$probes.Add(@{ sni = 'oceanfolio.vercel.app'; ip = $ip; note = ("解析 " + $n + " -> " + $ip) })
    }
  } catch {}
}

# Cloudflare
foreach ($ip in @('104.16.132.229', '104.17.209.9', '172.67.0.1')) {
  [void]$probes.Add(@{ sni = 'cloudflare.com'; ip = $ip; note = 'Cloudflare anycast' })
}
[void]$probes.Add(@{ sni = 'one.one.one.one'; ip = '1.1.1.1'; note = 'Cloudflare DNS 1.1.1.1' })

$fmt = '%{http_code}|%{time_connect}|%{time_appconnect}|%{time_total}|%{remote_ip}|%{size_download}'
foreach ($p in $probes) {
  $args = @(
    '-sS', '-o', 'NUL', '--max-time', '20',
    '--resolve', ($p.sni + ':443:' + $p.ip),
    '-w', $fmt,
    ('https://' + $p.sni + '/')
  )
  $out = & $curl @args 2>&1
  $text = ($out | Out-String).Trim()
  Write-Output ("{0,-34} {1,-16} {2}" -f $p.sni, $p.ip, $text)
  Write-Output ("     ↑ {0}" -f $p.note)
}

Section '说明'
Write-Output 'http_code=000 表示连接失败（不可达/被阻断）；'
Write-Output 'time_connect 是 TCP 握手耗时（含 DNS 之后的 RTT 量级），time_total 是完整请求耗时；'
Write-Output 'size_download 是响应体字节数（HEAD 未用时为首页文档大小）。'

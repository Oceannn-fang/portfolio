# 判定 Vercel 在国内的封锁方式：SNI 关键字 vs IP 段
#
# 背景：直连 Vercel anycast IP（76.76.21.x / 66.33.60.x）时 TLS 被 RST；
#       但 RFC 只保证"TCP 能连"——真正的阻断点在 TLS 握手，可能是
#       (a) SNI 命中关键字（如 vercel.app）→ 换自定义域名即可绕过
#       (b) 目标 IP 段被整段阻断          → 必须换前置（Cloudflare 等）
#
# 方法：用 curl --resolve 把同一个目标 IP 配上"不同的 SNI"分别请求，只看 SSL/TLS 与 HTTP 结果。
#   - 对照组 1：SNI = oceanfolio.vercel.app  → 已知被 RST
#   - 实验组  ：SNI = 挂在 Vercel 上的自定义域名（nextjs.org 等）
#   - 对照组 2：SNI = 走 Cloudflare 的第三方域名（验证 CF 边缘可用性）
#
# 用法：powershell -ExecutionPolicy Bypass -File test-sni-vs-ip.ps1

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$curl = (Get-Command curl.exe -ErrorAction SilentlyContinue).Source
if (-not $curl) { Write-Output 'curl.exe 不存在'; exit 1 }

function Resolve4($name) {
  $ips = @()
  foreach ($srv in @('223.5.5.5', '119.29.29.29', $null)) {
    try {
      $q = if ($srv) {
        Resolve-DnsName -Name $name -Server $srv -Type A -DnsOnly -QuickTimeout -ErrorAction Stop
      } else {
        Resolve-DnsName -Name $name -Type A -ErrorAction Stop
      }
      $ips += ($q | Where-Object { $_.IPAddress } | Select-Object -ExpandProperty IPAddress)
    } catch {}
  }
  return ($ips | Select-Object -Unique)
}

Write-Output '=== 各域名的解析结果（国内 223.5.5.5 / DNSPod / 本机）==='
$names = @('oceanfolio.vercel.app', 'nextjs.org', 'vercel.com', 'medium.com', 'cloudflare.com')
$resolved = @{}
foreach ($n in $names) {
  $ips = Resolve4 $n
  $resolved[$n] = $ips
  Write-Output ("{0,-24} {1}" -f $n, (($ips -join ', ')))
}

Write-Output ''
Write-Output '=== TLS/HTTP 实测（curl 直连，不走代理）==='
$fmt = '%{http_code}|appconnect=%{time_appconnect}|total=%{time_total}|remote=%{remote_ip}|bytes=%{size_download}'

$probes = New-Object System.Collections.ArrayList
# 对照组 1：vercel.app 的 SNI
[void]$probes.Add(@{ sni = 'oceanfolio.vercel.app'; ip = '76.76.21.21'; note = '对照：vercel.app 系 SNI × Vercel IP' })
# 实验组：Vercel 承载的自定义域名（若解析到 Vercel 段则用之）
foreach ($n in @('nextjs.org', 'vercel.com')) {
  foreach ($ip in $resolved[$n]) {
    [void]$probes.Add(@{ sni = $n; ip = $ip; note = ("自定义域名 SNI × 解析 IP（" + $n + "）") })
  }
}
# 对照组 2：Cloudflare 边缘
foreach ($ip in @('104.16.132.229', '104.17.209.9')) {
  [void]$probes.Add(@{ sni = 'cloudflare.com'; ip = $ip; note = 'Cloudflare 边缘' })
}
foreach ($ip in $resolved['medium.com']) {
  [void]$probes.Add(@{ sni = 'medium.com'; ip = $ip; note = '第三方 Cloudflare 站点（验证 CF 前置可用）' })
}

foreach ($p in $probes) {
  $out = & $curl '-sS' '-o' 'NUL' '--max-time' '20' '--noproxy' '*' `
                 '--resolve' ($p.sni + ':443:' + $p.ip) '-w' $fmt ('https://' + $p.sni + '/') 2>&1
  $text = ($out | Out-String).Trim() -replace '\s+', ' '
  Write-Output ("{0,-30} {1,-16} {2}" -f $p.sni, $p.ip, $text)
  Write-Output ("     {0}" -f $p.note)
}

Write-Output ''
Write-Output '=== 判读 ==='
Write-Output 'appconnect 有值且 http_code 正常 → TLS 握手成功、该 SNI 未被阻断；'
Write-Output 'http_code=000 且极快返回（<1s）→ 多为 TLS/SNI 被 RST（关键字阻断）；'
Write-Output 'http_code=000 且耗时=--max-time → 多为 IP 不可达（丢包/超时）。'

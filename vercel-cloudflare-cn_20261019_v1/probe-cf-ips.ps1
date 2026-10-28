# Cloudflare 各 anycast IP 段在国内的可用性实测
#
# 为什么测：Cloudflare 免费版走海外节点，且国内对其 IP 段是"部分可用"——
#   有的段 TCP 就通不了（约等于被丢包），有的段 TCP 通但 TLS 被 RST，有的段完全正常。
#   这决定了橙云（Proxied）能不能用、以及要不要"优选 IP"。
#
# 方法：统一用 SNI=cloudflare.com（该域名本身在国内未被封，已实测 301 正常），
#       逐个 CF anycast IP 直连（不走代理），看 time_connect（TCP）与 time_appconnect（TLS）。
#
# 判读：
#   connect=0             → TCP 不通（该段被丢包）
#   connect>0, appconnect=0 且 http_code=000 → TCP 通但 TLS 被 RST
#   http_code 有值         → 该段完全可用；appconnect 越小越好
#
# 用法：powershell -ExecutionPolicy Bypass -File probe-cf-ips.ps1

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$curl = (Get-Command curl.exe -ErrorAction SilentlyContinue).Source
if (-not $curl) { Write-Output '找不到 curl.exe'; exit 1 }

$ips = @(
  '104.16.132.229', '104.17.209.9', '104.18.0.1', '104.19.0.1', '104.20.0.1',
  '104.21.0.1', '104.22.0.1', '104.23.0.1', '104.24.0.1', '104.25.0.1',
  '104.26.0.1', '104.27.0.1', '108.162.192.1', '162.159.0.1', '162.159.140.1',
  '172.64.0.1', '172.66.0.1', '172.67.0.1', '173.245.48.1', '188.114.96.1',
  '190.93.240.1', '197.234.240.1'
)

$fmt = '%{http_code}|connect=%{time_connect}|appconnect=%{time_appconnect}|total=%{time_total}'
Write-Output ("{0,-16} {1,-16} {2,-16} {3}" -f 'IP', 'TCP握手(s)', 'TLS完成(s)', 'HTTP')
Write-Output ('-' * 72)

$ok = @()
foreach ($ip in $ips) {
  $out = & $curl '-sS' '-o' 'NUL' '--max-time' '6' '--noproxy' '*' `
                 '--resolve' ('cloudflare.com:443:' + $ip) '-w' $fmt 'https://cloudflare.com/' 2>&1
  $t = ($out | Out-String).Trim() -replace '\s+', ' '
  $parts = $t -split '\|'
  $code = $parts[0]; $con = ($parts[1] -replace 'connect=', ''); $app = ($parts[2] -replace 'appconnect=', '')
  $verdict = '不可用'
  if ($code -match '^\d{3}$' -and $code -ne '000') { $verdict = '可用'; $ok += [double]$app }
  elseif ([double]$con -gt 0 -and [double]$app -eq 0) { $verdict = 'TCP通/TLS被RST' }
  elseif ([double]$con -eq 0) { $verdict = 'TCP不通' }
  Write-Output ("{0,-16} {1,-16} {2,-16} {3}" -f $ip, $con, $app, ($code + '  ' + $verdict))
}

Write-Output ''
if ($ok.Count -gt 0) {
  $avg = ($ok | Measure-Object -Average).Average
  Write-Output ("可用段数量: {0}/{1}   平均 TLS 完成耗时: {2:N2}s" -f $ok.Count, $ips.Count, $avg)
  Write-Output '橙云若要稳，优先挑上面标"可用"且 TLS 完成耗时低的 IP 段（优选 IP 思路）。'
} else {
  Write-Output '本次未测到可用段 —— 橙云在国内风险较高，建议走灰云（DNS only）直连 Vercel。'
}

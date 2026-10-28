# GitHub Pages（github.io）国内可达性与吞吐实测
#
# 目的：回答"把站点放到 GitHub Pages 行不行"里的**线路**那一半。
#   - 可达性：DNS 是否污染、TCP/TLS 是否被阻断
#   - 吞吐：单连接复用抓多个资源，扣掉握手时间，避免小文件测速失真
#
# 用法：powershell -ExecutionPolicy Bypass -File measure-github-io.ps1

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$curl = (Get-Command curl.exe -ErrorAction SilentlyContinue).Source

$fmt = '%{http_code}|appconnect=%{time_appconnect}|total=%{time_total}|connect=%{time_connect}|bytes=%{size_download}'

Write-Output '=== 1. DNS：github.io 系列在国内是否被污染 ==='
foreach ($d in @('github.io', 'pages.github.com', 'jekyllrb.com')) {
  $lines = @()
  foreach ($srv in @('223.5.5.5', '119.29.29.29', '114.114.114.114')) {
    try {
      $ips = (Resolve-DnsName -Name $d -Server $srv -Type A -DnsOnly -QuickTimeout -ErrorAction Stop |
              Where-Object { $_.IPAddress } | Select-Object -ExpandProperty IPAddress -Unique) -join ','
      $lines += ("$srv=$ips")
    } catch { $lines += "$srv=FAIL" }
  }
  Write-Output ("  {0,-20} {1}" -f $d, ($lines -join '  '))
}
Write-Output '  （185.199.108-111.153 是 GitHub Pages 官方 anycast 段；出现别的 IP 即为污染）'

Write-Output ''
Write-Output '=== 2. 单资源直连（不走代理）==='
foreach ($u in @('https://pages.github.com/', 'https://jekyllrb.com/')) {
  $o = & $curl '-sS' '-o' 'NUL' '--max-time' '25' '--noproxy' '*' '-w' $fmt $u 2>&1
  Write-Output ('  ' + $u)
  Write-Output ('    ' + ((($o | Out-String).Trim() -replace '\s+', ' ')))
}

Write-Output ''
Write-Output '=== 3. 吞吐：单连接复用抓多个资源（扣掉 TLS 握手）==='
# jekyllrb.com 托管在 GitHub Pages；抓多页让连接复用，得到接近真实带宽的数字
$urls = @(
  'https://jekyllrb.com/',
  'https://jekyllrb.com/docs/',
  'https://jekyllrb.com/docs/installation/',
  'https://jekyllrb.com/docs/usage/',
  'https://jekyllrb.com/docs/configuration/',
  'https://jekyllrb.com/docs/liquid/',
  'https://jekyllrb.com/docs/plugins/',
  'https://jekyllrb.com/docs/themes/'
)
$all = @('-sS', '--max-time', '60', '--noproxy', '*')
foreach ($u in $urls) { $all += @('-o', 'NUL', $u) }
$all += @('-w', 'TOTAL bytes=%{size_download} time=%{time_total} appconnect=%{time_appconnect}')
$o = & $curl @all 2>&1
$t = (($o | Out-String).Trim() -split "`n" | Where-Object { $_ -match 'TOTAL' } | Select-Object -Last 1)
Write-Output ('  ' + $t)
if ($t -match 'bytes=(\d+) time=([\d.]+) appconnect=([\d.]+)') {
  $bytes = [double]$Matches[1]; $total = [double]$Matches[2]; $app = [double]$Matches[3]
  $xfer = [math]::Max($total - $app, 0.001)
  Write-Output ("  => {0:N0} KB / {1:N2}s ≈ {2:N0} KB/s（{3} 个页面，连接复用）" -f ($bytes/1KB), $xfer, ($bytes/1KB/$xfer), $urls.Count)
}

Write-Output ''
Write-Output '=== 4. raw.githubusercontent.com（常被单独阻断，影响 CI/图片直链）==='
$o = & $curl '-sS' '-o' 'NUL' '--max-time' '15' '--noproxy' '*' '-w' $fmt 'https://raw.githubusercontent.com/' 2>&1
Write-Output ('  ' + ((($o | Out-String).Trim() -replace '\s+', ' ')))

# 自定义域名国内可达性复测（一条命令出结论）
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File verify-domain.ps1 -Domain fang.art
#   powershell -ExecutionPolicy Bypass -File verify-domain.ps1 -Domain www.fang.art -AlsoWww $false
#
# 检查项：
#   1. 多解析器 DNS（阿里 / DNSPod / 本机）：是否解析到 Vercel 的 76.76.21.x、66.33.60.x
#   2. 直连（不走系统代理、用系统 DNS）：HTTP 状态、TLS 证书校验、各阶段耗时
#   3. 指定 Vercel IP + 正确 SNI 直连：绕开 DNS 单看线路通不通
#   4. HTTP → HTTPS 跳转、www 变体
#
# 判读：第 2 项 http_code=200 且 ssl_verify=0 即为「国内可直连可用」。

param(
  [Parameter(Mandatory = $true)][string]$Domain,
  [string]$VercelIp = '76.76.21.21',
  [bool]$AlsoWww = $true
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$curl = (Get-Command curl.exe -ErrorAction SilentlyContinue).Source
if (-not $curl) { Write-Output '错误：找不到 curl.exe'; exit 1 }

function Line($t) { Write-Output ('------------------------------------------------------------'); Write-Output $t }

# ---------- 1. DNS ----------
Line "[1/4] DNS 解析：$Domain"
foreach ($srv in @('223.5.5.5', '119.29.29.29', $null)) {
  $label = if ($srv) { $srv } else { '本机默认' }
  try {
    $q = if ($srv) {
      Resolve-DnsName -Name $Domain -Server $srv -Type A -DnsOnly -QuickTimeout -ErrorAction Stop
    } else {
      Resolve-DnsName -Name $Domain -Type A -ErrorAction Stop
    }
    $ips = $q | Where-Object { $_.IPAddress } | Select-Object -ExpandProperty IPAddress -Unique
    $verdict = if (-not $ips) { '无 A 记录' }
      elseif ($ips -match '^76\.76\.21\.|^66\.33\.60\.|^216\.198\.79\.') { 'OK（Vercel 段）' }
      else { '注意：不像 Vercel 段，可能被污染或未配好' }
    Write-Output ("  {0,-14} {1}   {2}" -f $label, (($ips -join ', ')), $verdict)
  } catch {
    Write-Output ("  {0,-14} 解析失败: {1}" -f $label, $_.Exception.Message)
  }
}

# ---------- 2. 直连（真实访客路径：系统 DNS，无代理） ----------
Line "[2/4] 直连（不走代理，走系统 DNS）—— 这一项才是访客看到的结果"
$fmt = '%{http_code}|ssl_verify=%{ssl_verify_result}|appconnect=%{time_appconnect}|total=%{time_total}|remote=%{remote_ip}|bytes=%{size_download}'
$direct = & $curl '-sS' '-o' 'NUL' '--max-time' '25' '--noproxy' '*' '-w' $fmt ('https://' + $Domain + '/') 2>&1
Write-Output ('  ' + (($direct | Out-String).Trim() -replace '\s+', ' '))
$directText = ($direct | Out-String)

# ---------- 3. 指定 IP + 正确 SNI ----------
Line "[3/4] 指定 Vercel IP（$VercelIp）+ SNI=$Domain —— 单看线路"
$byIp = & $curl '-sS' '-o' 'NUL' '--max-time' '25' '--noproxy' '*' '--resolve' ($Domain + ':443:' + $VercelIp) '-w' $fmt ('https://' + $Domain + '/') 2>&1
Write-Output ('  ' + (($byIp | Out-String).Trim() -replace '\s+', ' '))

# ---------- 4. 跳转与 www ----------
Line '[4/4] HTTP 跳转与 www 变体'
$h = & $curl '-sS' '-o' 'NUL' '--max-time' '20' '--noproxy' '*' '-w' '%{http_code}->%{redirect_url}' ('http://' + $Domain + '/') 2>&1
Write-Output ('  http://' + $Domain + '/  =>  ' + (($h | Out-String).Trim()))
if ($AlsoWww) {
  $w = & $curl '-sS' '-o' 'NUL' '--max-time' '25' '--noproxy' '*' '-w' $fmt ('https://www.' + $Domain + '/') 2>&1
  Write-Output ('  https://www.' + $Domain + '/  =>  ' + (($w | Out-String).Trim() -replace '\s+', ' '))
}

# ---------- 结论 ----------
Line '结论'
if ($directText -match '\|ssl_verify=0\|' -and $directText -match '^200\|') {
  Write-Output '  ✅ 国内可直连：HTTP 200 且证书校验通过。'
} elseif ($directText -match '000\|') {
  Write-Output '  ❌ 直连失败：检查 DNS 是否解析到 Vercel 段、Vercel 里域名是否已验证/证书是否签发。'
} else {
  Write-Output '  ⚠️ 直连异常：看上面 http_code 与 ssl_verify 的具体值。'
}
Write-Output '  提示：本脚本已强制 --noproxy，若本机开着代理，这一项仍反映直连结果。'

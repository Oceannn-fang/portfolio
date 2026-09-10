# Copy new portfolio PNGs from OneDrive archive to public/images/portfolio
# Uses Get-ChildItem to avoid encoding issues with Chinese path
$src = Get-Item "C:\Users\86185\OneDrive\*\存档"
$dst = "e:\portfolio\public\images\portfolio"

if (-not $src) {
  Write-Host "ERROR: Source folder not found"
  exit 1
}

$existing = (Get-ChildItem $dst -Filter '*.png').Name
$allPngs = Get-ChildItem $src.FullName -Filter '*.png'
$copied = 0

foreach ($f in $allPngs) {
  if ($existing -notcontains $f.Name) {
    Copy-Item $f.FullName (Join-Path $dst $f.Name) -Force
    $copied++
    Write-Host "Copied: $($f.Name)"
  }
}
Write-Host "Done. Copied $copied new files."

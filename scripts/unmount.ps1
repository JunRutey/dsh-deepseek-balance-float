# Unmounts dsh-deepseek-balance-float from a DSH profile.
#
# Use this when the GUI refuses to start after adding the widget: mounting a
# broken client entry fails the web boot audit, and DSH treats that as a boot
# failure. Removing the bundle and restarting restores the app.
#
#   pwsh -File scripts/unmount.ps1                      # desktop profile
#   pwsh -File scripts/unmount.ps1 -Profile myprofile   # another profile
#
# The profile's cordis.patch.yml is never touched: the widget is mounted by its
# bundle layer, which disappears with the bundle entry.

param(
	[string]$Profile = 'desktop',
	[string]$Package = 'dsh-deepseek-balance-float'
)

$ErrorActionPreference = 'Stop'
$profileDir = Join-Path $env:USERPROFILE ".dsh\profiles\$Profile"
$manifestPath = Join-Path $profileDir 'package.json'

if (-not (Test-Path $manifestPath)) { throw "profile manifest not found: $manifestPath" }

Copy-Item $manifestPath "$manifestPath.bak" -Force
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

if ($manifest.dependencies.PSObject.Properties.Name -contains $Package) {
	$manifest.dependencies.PSObject.Properties.Remove($Package)
}
$bundles = @($manifest.dsh.profile.bundles | Where-Object { $_ -ne $Package })
$manifest.dsh.profile.bundles = $bundles

$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding utf8
Write-Host "removed $Package from $manifestPath (backup: $manifestPath.bak)"

$node = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$pnpm = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
if ((Test-Path $node) -and (Test-Path $pnpm)) {
	& $node $pnpm install --dir $profileDir --reporter=append-only
	Write-Host 'dependencies reconciled; restart DSH to boot the previous composition.'
} else {
	Write-Warning "bundled node/pnpm not found; run 'pnpm install' in $profileDir manually, then restart DSH."
}

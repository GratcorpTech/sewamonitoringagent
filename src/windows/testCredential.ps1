
$ErrorActionPreference = "Stop"

$configPath = Join-Path $env:LOCALAPPDATA "SEWA\MonitoringAgent\config\settings.json"

if (!(Test-Path $configPath)) {
    throw "SEWA settings file not found."
}

$settings = Get-Content $configPath -Raw | ConvertFrom-Json

if (!$settings.passwordEncrypted) {
    throw "Encrypted password not found."
}

Add-Type -AssemblyName System.Security

$encryptedBytes = [Convert]::FromBase64String(
    $settings.passwordEncrypted
)

if ($encryptedBytes.Length -le 3) {
    throw "Encrypted credential is too short."
}

$prefix = [System.Text.Encoding]::ASCII.GetString(
    $encryptedBytes,
    0,
    3
)

Write-Output "Encryption format: $prefix"

if ($prefix -match "^v\d\d$") {
    # Electron/Chromium versioned encryption format.
    $cipherBytes = $encryptedBytes[3..($encryptedBytes.Length - 1)]
}
else {
    # Try the complete buffer if no version marker exists.
    $cipherBytes = $encryptedBytes
}

$decryptedBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
    [byte[]]$cipherBytes,
    $null,
    [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)

$password = [System.Text.Encoding]::UTF8.GetString($decryptedBytes)

if ([string]::IsNullOrEmpty($password)) {
    throw "Password decryption returned an empty value."
}

Write-Output "SUCCESS: Windows DPAPI decrypted the saved credential."

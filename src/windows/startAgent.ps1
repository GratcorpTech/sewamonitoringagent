
$ErrorActionPreference = "Stop"

$agentPath = Join-Path $PSScriptRoot "sewa-monitoring-agent.exe"
$logDirectory = Join-Path $env:LOCALAPPDATA "SEWA\MonitoringAgent\logs"
$logPath = Join-Path $logDirectory "startup.log"

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

function Write-StartupLog($message) {
    Add-Content -Path $logPath -Value "$(Get-Date -Format o) $message"
}

try {
    if (!(Test-Path $agentPath)) {
        throw "Agent executable not found: $agentPath"
    }

    $existing = Get-Process -Name "sewa-monitoring-agent" -ErrorAction SilentlyContinue

    if ($existing) {
        Write-StartupLog "Agent already running. PID: $($existing.Id)"
        exit 0
    }

    Write-StartupLog "Starting agent: $agentPath"

    $process = Start-Process `
        -FilePath $agentPath `
        -WorkingDirectory $PSScriptRoot `
        -WindowStyle Hidden `
        -PassThru

    Write-StartupLog "Agent process launched. PID: $($process.Id)"

    Start-Sleep -Seconds 3

    $process.Refresh()

    if ($process.HasExited) {
        Write-StartupLog "ERROR: Agent exited. Exit code: $($process.ExitCode)"
    }
    else {
        Write-StartupLog "Agent is running successfully. PID: $($process.Id)"
    }
}
catch {
    Write-StartupLog "ERROR: $($_.Exception.Message)"
    exit 1
}

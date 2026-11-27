
$ErrorActionPreference = "Stop"

# This script is installed in <install dir>\resources\agent.
$resourcesPath = Split-Path -Parent $PSScriptRoot
$runtimePath = (Resolve-Path (Join-Path $resourcesPath "..\SEWA Monitoring Agent.exe")).Path
$agentScript = Join-Path $PSScriptRoot "agent.cjs"
$logDirectory = Join-Path $env:LOCALAPPDATA "SEWA\MonitoringAgent\logs"
$logPath = Join-Path $logDirectory "startup.log"

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

function Write-StartupLog($message) {
    Add-Content -Path $logPath -Value "$(Get-Date -Format o) $message"
}

try {
    if (!(Test-Path $agentScript)) {
        throw "Agent script not found: $agentScript"
    }

    # The agent holds a single-instance mutex and exits if one is already running.
    # It gets its own hidden console so closing the launching window cannot kill it.
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $runtimePath
    $startInfo.Arguments = "`"$agentScript`""
    $startInfo.WorkingDirectory = $PSScriptRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.EnvironmentVariables["ELECTRON_RUN_AS_NODE"] = "1"
    $startInfo.EnvironmentVariables["SEWA_AGENT_SCRIPTS_DIR"] = $PSScriptRoot
    $startInfo.EnvironmentVariables["NODE_PATH"] = (Join-Path $resourcesPath "app.asar\node_modules") + ";" + (Join-Path $resourcesPath "app.asar.unpacked\node_modules")

    Write-StartupLog "Starting agent: $agentScript"

    $process = [System.Diagnostics.Process]::Start($startInfo)

    Write-StartupLog "Agent process launched. PID: $($process.Id)"

    Start-Sleep -Seconds 3

    $process.Refresh()

    if ($process.HasExited) {
        Write-StartupLog "Agent exited. Exit code: $($process.ExitCode) (0 means another instance is already running)"
    }
    else {
        Write-StartupLog "Agent is running successfully. PID: $($process.Id)"
    }
}
catch {
    Write-StartupLog "ERROR: $($_.Exception.Message)"
    exit 1
}

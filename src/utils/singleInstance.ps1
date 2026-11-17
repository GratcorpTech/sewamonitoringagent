
param(
    [Parameter(Mandatory = $true)]
    [string]$MutexName
)

$mutex = $null
$acquired = $false

try {
    $mutex = New-Object System.Threading.Mutex(
        $false,
        $MutexName
    )

    try {
        $acquired = $mutex.WaitOne(0)
    }
    catch [System.Threading.AbandonedMutexException] {
        $acquired = $true
    }

    if (-not $acquired) {
        exit 2
    }

    # Tell Node.js that this instance owns the mutex.
    [Console]::Out.WriteLine("READY")
    [Console]::Out.Flush()

    # Keep this process and mutex alive until Node closes stdin.
    while ($null -ne [Console]::In.ReadLine()) {
    }
}
finally {
    if ($acquired -and $mutex) {
        $mutex.ReleaseMutex()
    }

    if ($mutex) {
        $mutex.Dispose()
    }
}

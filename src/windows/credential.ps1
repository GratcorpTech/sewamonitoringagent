
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("encrypt", "decrypt")]
    [string]$Operation
)

$ErrorActionPreference = "Stop"

try {
    Add-Type -AssemblyName System.Security

    # Read input from stdin rather than command-line arguments.
    $inputText = [Console]::In.ReadToEnd()

    if ([string]::IsNullOrEmpty($inputText)) {
        throw "No credential input provided."
    }

    switch ($Operation) {
        "encrypt" {
            $plainBytes = [System.Text.Encoding]::UTF8.GetBytes($inputText)

            $encryptedBytes = [System.Security.Cryptography.ProtectedData]::Protect(
                $plainBytes,
                $null,
                [System.Security.Cryptography.DataProtectionScope]::CurrentUser
            )

            $output = [Convert]::ToBase64String($encryptedBytes)

            [Console]::Out.Write($output)
        }

        "decrypt" {
            $encryptedBytes = [Convert]::FromBase64String($inputText)

            $plainBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
                $encryptedBytes,
                $null,
                [System.Security.Cryptography.DataProtectionScope]::CurrentUser
            )

            $output = [System.Text.Encoding]::UTF8.GetString($plainBytes)

            [Console]::Out.Write($output)
        }
    }

    exit 0
}
catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}

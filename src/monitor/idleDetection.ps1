
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class IdleMonitor
{
    [StructLayout(LayoutKind.Sequential)]
    private struct LASTINPUTINFO
    {
        public uint cbSize;
        public uint dwTime;
    }

    [DllImport("user32.dll")]
    private static extern bool GetLastInputInfo(
        ref LASTINPUTINFO plii
    );

    public static uint GetIdleTime()
    {
        LASTINPUTINFO info = new LASTINPUTINFO();
        info.cbSize = (uint)Marshal.SizeOf(info);

        if (!GetLastInputInfo(ref info))
        {
            throw new Exception("GetLastInputInfo failed");
        }

        uint currentTick = unchecked((uint)Environment.TickCount);

        return unchecked(currentTick - info.dwTime);
    }
}
"@

while ($true) {
    try {
        $idleMilliseconds = [IdleMonitor]::GetIdleTime()
        [Console]::WriteLine($idleMilliseconds)
        [Console]::Out.Flush()
    }
    catch {
        [Console]::WriteLine("ERROR")
        [Console]::Out.Flush()
    }

    Start-Sleep -Milliseconds 1000
}

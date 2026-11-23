
!macro customInstall
  SetShellVarContext current

  CreateShortCut "$APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\SEWA Monitoring Agent.lnk" "$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "$INSTDIR\resources\agent\startAgent.ps1"' "$INSTDIR\SEWA Monitoring Agent.exe" 0 SW_SHOWNORMAL
!macroend

!macro customUnInstall
  SetShellVarContext current

  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\SEWA Monitoring Agent.lnk"
!macroend

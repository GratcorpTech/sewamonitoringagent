
; The agent runs detached and keeps the single-instance lock, so a previous
; version must be stopped or the new agent exits and the old code keeps running.
!macro stopSewaAgent
  nsExec::Exec 'taskkill /F /T /IM "sewa-monitoring-agent.exe"'
  nsExec::Exec 'taskkill /F /T /IM "SEWA Monitoring Agent.exe"'
  Sleep 1500
!macroend

!macro customInit
  !insertmacro stopSewaAgent
!macroend

!macro customInstall
  SetShellVarContext current

  CreateShortCut "$APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\SEWA Monitoring Agent.lnk" "$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "$INSTDIR\resources\agent\startAgent.ps1"' "$INSTDIR\SEWA Monitoring Agent.exe" 0 SW_SHOWMINIMIZED
!macroend

!macro customUnInstall
  !insertmacro stopSewaAgent
  SetShellVarContext current

  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\SEWA Monitoring Agent.lnk"
!macroend

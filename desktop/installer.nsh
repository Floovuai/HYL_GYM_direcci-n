!ifndef BUILD_UNINSTALLER
  !define MUI_ABORTWARNING
  !define MUI_ABORTWARNING_TEXT "¿Deseas cancelar la instalación de DashCom?"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW DashComInstFilesShow

  Function DashComInstFilesShow
    GetDlgItem $0 $HWNDPARENT 2
    EnableWindow $0 1
  FunctionEnd
!endif

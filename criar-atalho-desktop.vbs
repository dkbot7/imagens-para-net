Set WshShell = CreateObject("WScript.Shell")

' Obter caminho do Desktop
DesktopPath = WshShell.SpecialFolders("Desktop")

' Criar atalho
Set oShellLink = WshShell.CreateShortcut(DesktopPath & "\🎨 Conversor AVIF.lnk")

' Configurar atalho
oShellLink.TargetPath = WScript.ScriptFullName
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)

oShellLink.TargetPath = ScriptDir & "\iniciar-conversor.bat"
oShellLink.WorkingDirectory = ScriptDir
oShellLink.Description = "Conversor de Imagens para AVIF - Clique para iniciar"
oShellLink.IconLocation = "shell32.dll,23"

oShellLink.Save

' Mensagem de sucesso
MsgBox "✅ Atalho criado no Desktop com sucesso!" & vbCrLf & vbCrLf & "Nome: 🎨 Conversor AVIF" & vbCrLf & vbCrLf & "Clique nele para iniciar o aplicativo!", vbInformation, "Sucesso"

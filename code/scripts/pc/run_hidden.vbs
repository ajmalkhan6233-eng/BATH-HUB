' Runs a node script with NO window (so the 5-minute check never flashes a black box). Used by the scheduled tasks.
' Usage: wscript.exe //B //Nologo run_hidden.vbs <full path of the .js file>
Set fso = CreateObject("Scripting.FileSystemObject")
root = WScript.ScriptFullName
For i = 1 To 3
  root = fso.GetParentFolderName(root)
Next
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = root
sh.Run "node """ & WScript.Arguments(0) & """", 0, True

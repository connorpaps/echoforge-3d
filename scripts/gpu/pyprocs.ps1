Get-CimInstance Win32_Process -Filter "name='python.exe'" | ForEach-Object {
    $cmd = ($_.CommandLine -replace '\s+', ' ')
    if ($cmd.Length -gt 130) { $cmd = $cmd.Substring(0, 130) }
    '{0} | created {1} | {2}' -f $_.ProcessId, $_.CreationDate, $cmd
}

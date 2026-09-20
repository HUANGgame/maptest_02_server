$ErrorActionPreference = "Stop"

$env:AZURE_SQL_SERVER = "karea-indoor-nav-sql-ea.database.windows.net"
$env:AZURE_SQL_DATABASE = "indoor-navigation"
$env:AZURE_SQL_USER = "s413637629"
$env:AZURE_SQL_PORT = "1433"
$env:AZURE_SQL_ENCRYPT = "true"
$env:AZURE_SQL_SKIP_CACHE_HYDRATE = "true"

$securePassword = Read-Host "SQL password" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $env:AZURE_SQL_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  npm run seed:azure-sql 2>&1 | Tee-Object -FilePath "azure-sql-seed.log"
  if ($LASTEXITCODE -ne 0) {
    throw "Azure SQL import failed"
  }
  Write-Host "Import completed. You can close this window."
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  Remove-Item Env:AZURE_SQL_PASSWORD -ErrorAction SilentlyContinue
}

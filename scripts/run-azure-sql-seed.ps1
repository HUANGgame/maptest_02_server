$ErrorActionPreference = "Stop"

function Read-RequiredValue([string]$Prompt, [string]$DefaultValue = "") {
  $suffix = if ($DefaultValue) { " [$DefaultValue]" } else { "" }
  $value = Read-Host "$Prompt$suffix"
  if ([string]::IsNullOrWhiteSpace($value)) { $value = $DefaultValue }
  if ([string]::IsNullOrWhiteSpace($value)) { throw "$Prompt is required" }
  return $value.Trim()
}

$env:AZURE_SQL_SERVER = Read-RequiredValue "Azure SQL server" "karea-indoor-nav-sql-ea.database.windows.net"
$env:AZURE_SQL_DATABASE = Read-RequiredValue "Database" "indoor-navigation"
$env:AZURE_SQL_USER = Read-RequiredValue "SQL administrator login"
$securePassword = Read-Host "SQL password" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $env:AZURE_SQL_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $env:AZURE_SQL_PORT = "1433"
  $env:AZURE_SQL_ENCRYPT = "true"
  $env:AZURE_SQL_SKIP_CACHE_HYDRATE = "true"
  npm run seed:azure-sql 2>&1 | Tee-Object -FilePath "azure-sql-seed.log"
  $importExitCode = $LASTEXITCODE
  if ($importExitCode -ne 0) {
    Write-Error "Azure SQL import failed. See azure-sql-seed.log for the original error."
    exit $importExitCode
  }
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  Remove-Item Env:AZURE_SQL_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:AZURE_SQL_USER -ErrorAction SilentlyContinue
  Remove-Item Env:AZURE_SQL_SKIP_CACHE_HYDRATE -ErrorAction SilentlyContinue
}

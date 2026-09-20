# Azure SQL migration

The backend uses Azure SQL as the primary fingerprint store when the `AZURE_SQL_*` settings are present. Firebase remains available for compatibility during migration, but new fingerprint uploads are written to Azure SQL only.

## Required settings

```text
AZURE_SQL_SERVER=<server>.database.windows.net
AZURE_SQL_DATABASE=indoor-navigation
AZURE_SQL_PORT=1433
AZURE_SQL_USER=<application-login>
AZURE_SQL_PASSWORD=<secret>
AZURE_SQL_ENCRYPT=true
```

Keep credentials in the hosting provider's secret settings. Do not commit them to Git.

## Deployment order

1. Create an Azure SQL Database and select automatic pause when the free allowance is exhausted.
2. Restrict the SQL firewall to the backend service's outbound addresses where possible.
3. Run `schema/azure-sql.sql`, or allow the backend to create the same schema during its first connection.
4. Add the settings above to the backend service.
5. Run `npm run migrate:azure-sql` once to copy existing Firebase fingerprints and local document snapshots.
6. Check `/api/storage/status`; `storage` must be `azure-sql` and the fingerprint counts must match the source.
7. Upload one new field sample and verify that its point, BSSID count, and timestamp appear in `/api/wifi-scans/summary`.

## Capacity decision

The current local dataset contains about 51,000 Wi-Fi observations. Azure SQL is the preferred primary store because the data is relational, the positioning queries need stable indexes, and the student subscription can use the Azure SQL free offer while it remains within the included limits. Firebase remains a temporary migration source, not the long-term fingerprint database.

The migration is complete only after the Azure record count, scope count, point count, and newest timestamp match the source. Keep a JSON export before removing any source records.

Do not remove Firebase credentials until reviews and remaining small compatibility collections have been moved and verified.

# Pharmacy First Supply Token Validation

## Purpose

This script logs into PharmOutcomes, impersonates a specified provider, navigates to a Pharmacy First Supply Token record, downloads the associated PDF token, and captures a screenshot for validation and audit purposes.

## Prerequisites

- Valid PharmOutcomes credentials supplied to the automation runner.
- `ODSCODE` environment variable set to the target provider's ODS code.
- Access to the target Pharmacy First service record.
- Playwright automation framework configured and working.
- A valid `runDir` configured in the script runtime configuration.

## What the Script Does

### 1. Login to PharmOutcomes

The script authenticates using the supplied username and password against the **PRIM** environment.

### 2. Login as Provider

After successful authentication, the script switches context to the provider identified by the `ODSCODE` environment variable.

### 3. Open Pharmacy First Supply Token Record

The script navigates directly to a predefined Pharmacy First consultation record:

```text
/pharmoutcomes/services/enter/?edit=737350211&xid=164506&xact=provisionedit
```

The page is loaded with a `networkidle` wait condition to ensure all content has finished loading.

### 4. Download Supply Token

The script:

- Waits for a download event.
- Clicks the **"Pharmacy First Supply Token"** link.
- Downloads the generated PDF.
- Saves the file as:

```text
PharmacyFirstSupplyToken.pdf
```

within the configured run directory.

### 5. Capture Validation Screenshot

A full-page screenshot of the token page is taken and saved as:

```text
token-validation.png
```

This provides evidence that the correct record and token were accessed.

### 6. Complete Execution

The script logs completion and exits successfully.

---

## Files Generated

| File | Description |
|--------|-------------|
| `PharmacyFirstSupplyToken.pdf` | Downloaded Pharmacy First Supply Token PDF |
| `token-validation.png` | Full-page screenshot of the viewed record |

---

## Logging

The following major actions are logged:

- Script start
- Login
- Login as provider
- Opening Pharmacy First Supply Token
- Token downloaded
- Screenshot captured
- Script finished

---

## Error Handling

Any unhandled error will:

1. Be written to the console with a stack trace where available.
2. Cause the process to exit with status code `1`.

Example:

```text
Script failed: <error details>
```

---

## Environment Variables

| Variable | Description |
|------------|-------------|
| `ODSCODE` | ODS code of the provider to impersonate |

---

## Expected Outcome

A successful run produces:

- Successful login to PharmOutcomes.
- Provider impersonation completed.
- Pharmacy First Supply Token PDF downloaded.
- Validation screenshot captured.
- Completion without errors.
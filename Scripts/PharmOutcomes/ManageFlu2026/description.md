# PharmOutcomes Flu 2026 Runner

## Overview

This tool automates the management of PharmOutcomes Flu 2026 service accreditation and commissioner removal using Playwright.

The script reads a CSV file containing ODS codes and actions, logs into PharmOutcomes, opens each provider record, and then performs one of the following actions:

- Add a service accreditation
- Remove a commissioner
- Skip records with invalid or incomplete data

The automation intentionally follows the same workflow as a human user interacting with the PharmOutcomes interface.

---

## Features

### Service Accreditation

For providers marked as **Add**:

1. Opens the provider record.
2. Checks whether the target service is already accredited.
3. If already accredited:

   ```text
   ℹ️ Service 167619 already accredited
   ```

4. If not accredited:

   ```text
   ✅ Accrediting service 167619
   ```

5. The provider is updated through the normal PharmOutcomes UI.

---

### Commissioner Removal

For providers marked as **Remove**:

1. Opens the provider record.
2. Searches for the commissioner removal link.
3. If found:

   ```text
   ✅ Removed commissioner 46868722
   ```

4. If not found:

   ```text
   ℹ️ Commissioner 46868722 not assigned (or already removed)
   ```

This is not treated as an error because the commissioner may have already been removed during a previous run.

---

## CSV Input

The script reads a CSV containing:

| Column | Description |
|----------|----------|
| ODS Code | Provider ODS code |
| Add/Remove | Action to perform |

Example:

```csv
ODS Code,Add/Remove
FYW42,Remove
FDW31,Add
```

---

## Logging

The runner provides timing information for each major operation.

Example:

```text
21:18:14 🏥 Opening provider FGY24
21:18:18 Edit Provider: 3596ms
21:18:22 ℹ️ Service 167619 already accredited
21:18:22 Completed in: 3915ms
```

Example commissioner removal:

```text
21:18:22 🏥 Opening provider FYW42
21:18:25 Edit Provider: 3302ms
21:18:30 ℹ️ Commissioner 46868722 not assigned (or already removed)
21:18:30 Completed in: 5005ms
```

---

## Validation

Rows with missing data are skipped automatically.

Example:

```text
❌ Skipping row 8: Missing Add/Remove value
❌ Skipping row 9: Missing ODS Code, Missing Add/Remove value
```

---

## Performance

Observed performance during testing:

### Already Accredited

```text
~3 seconds per provider
```

### New Accreditation

```text
~6-8 seconds per provider
```

### Commissioner Already Removed

```text
~5 seconds per provider
```

### Average Throughput

Approximately:

```text
5-7 seconds per provider
```

A CSV containing approximately 600 providers is expected to complete in around:

```text
50-90 minutes
```

depending on network conditions and the mix of actions.

---

## Authentication

Credentials are loaded from the encrypted environment file:

```text
env.enc
```

Successful startup:

```text
✅ Environment variables loaded from env.enc
```

---

## Design Principles

The automation prioritises:

- Reliability over speed
- Human-like interaction with PharmOutcomes
- Clear logging
- Safe re-runs
- Idempotent behaviour where possible

Re-running the same CSV should not cause issues:

- Already accredited services are detected.
- Previously removed commissioners are reported and skipped.
- Invalid rows are ignored.

---

## Typical Workflow

```text
Load environment
↓
Read CSV
↓
Login to PharmOutcomes
↓
Loop through providers
↓
Open provider
↓
Add accreditation OR remove commissioner
↓
Log outcome
↓
Continue to next provider
↓
Complete run
```
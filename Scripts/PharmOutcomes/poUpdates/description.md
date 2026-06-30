This script updates Purchase Order (PO) numbers for accredited providers
based on a CSV mapping, within a specific service and commissioner context.

The script:

- Logs into the system as a primary user
- Switches to a commissioner account
- Navigates to the accreditation page for a given service
- Identifies *checked (selected)* rows in the UI
- Matches each row’s ODS code against a CSV lookup
- Updates the PO number field for matching rows

This script is designed for **targeted bulk updates** using a combination of
CSV data and UI state.

---

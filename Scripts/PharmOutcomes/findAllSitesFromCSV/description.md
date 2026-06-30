This script processes a CSV of ODS codes and determines whether each code
exists within the system, along with its associated region.

For each ODS code:
- Attempts to resolve the provider context
- Determines if the provider exists
- Identifies the associated region (if available)
- Outputs results into separate CSV files

This script is designed as a **lookup and validation utility** rather than a
modification or update script.

---

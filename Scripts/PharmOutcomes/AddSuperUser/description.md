This script creates (or verifies) a SuperUser account for a single provider
based on an ODS code passed via the command line.

It performs the following steps:

- Logs into the specified provider
- Opens the provider configuration
- Checks if a SuperUser already exists
- Creates a new SuperUser if one is not found
- Assigns permissions and security credentials

This script is designed as a **single-run utility**, not a batch process.

---

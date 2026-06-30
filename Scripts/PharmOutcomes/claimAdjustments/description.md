This script processes a CSV of provider ODS codes and performs claim adjustments
via the PharmOutcomes system under a specified commissioner context.

For each row:
- Logs into the system using primary credentials
- Switches to a commissioner account
- Navigates directly to the claims adjustment page
- Executes optional advanced automation steps
- Records successful updates to an output CSV

---

### CSV Format

The input CSV must contain an ODS column:


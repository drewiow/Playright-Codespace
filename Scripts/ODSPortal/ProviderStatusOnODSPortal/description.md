# ODS Status Lookup Script

## Overview

This script checks whether a given ODS code is active by querying the NHS ODS Data Search website.

It launches a browser session, performs a lookup for the provided ODS code, and logs whether the organisation is **active** or **not active**.

---

## What it does

- Opens the NHS ODS Data Search site
- Searches for the provided `ODS_CODE`
- Reads the status from the results table
- Logs the result (`active` / `not active`)
- Cleans up the browser session

---

## Input

Provided via environment variables:

- `ODS_CODE` – the organisation code to look up

---

## Output

- Logs the status of the ODS code in real time
- Example:
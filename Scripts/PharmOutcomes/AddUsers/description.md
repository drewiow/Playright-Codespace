# 👥 Account Creation

## Overview

This script automates the creation of user accounts across multiple providers in PharmOutcomes using a CSV input.

It creates a user, generates aa temporary password, and gives full permissions to them

---

## What it does

1. 🔐 Logs into PharmOutcomes  
2. 📄 Reads account data from a CSV file  
3. 👤 Creates user accounts for each provider  
4. ⚙️ Applies permissions and settings  
6. 📊 Outputs a CSV file with linked account details  

---

### CSV Requirements

The CSV should include:

- `odsCode`
- `first name`
- `last name`
- `professional body`
- `gphcregistration`
- `tel num`
- `nhs email address`
- `other email`
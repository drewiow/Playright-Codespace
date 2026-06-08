# 👥 Account Creation & Linking Script

## Overview

This script automates the creation and linking of user accounts across multiple providers in PharmOutcomes using a CSV input.

It creates a base user, generates additional users per provider, and then links all accounts together under the primary user.

---

## What it does

1. 🔐 Logs into PharmOutcomes  
2. 📄 Reads account data from a CSV file  
3. 👤 Creates user accounts for each provider  
4. ⚙️ Applies permissions and settings  
5. 🔗 Links all created accounts to a base user  
6. 📊 Outputs a CSV file with linked account details  

---

### CSV Requirements

The CSV should include:

- `odsCode`
- `newUser`
- `fullName`
- `email`
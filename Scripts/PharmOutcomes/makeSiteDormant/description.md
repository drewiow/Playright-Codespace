# 🧾 Script Introduction

## What this script does

This script automates the process of updating PharmOutcomes provider records in bulk using a CSV file.

For each row in the CSV, it will:

- 🔐 Log into the system  
- 👤 Open the provider using the selected ODS code  
- 🔧 Deaccredit a specified service (PIDService)  
- 🏷️ Update the Account Reference (sets `EX_COVID` if not already present)  
- 📝 Add an audit entry using the provided case reference  
- 💾 Save the changes  
- ↩️ Exit the provider and move to the next record  

---

## How it works

1. Upload a CSV file containing provider data  
2. Select which column contains the ODS codes  
3. Start the run  
4. The script processes each row one by one automatically  

---

## What you need

Your CSV must contain:

- ✅ An ODS code column (selected in the UI)  
- ✅ `caseref` (for audit logging)  
- ✅ `PIDService` (the service to deaccredit)  

---

## What to expect

- ✅ Each row is processed independently  
- ✅ Errors on one row do not stop the script  
- ✅ Progress is logged in real time  
- ✅ A results file is generated at the end  

---

## When to use this

Use this script when you need to:

- Deaccredit multiple providers at once  
- Apply consistent updates across many sites  
- Add audit entries in bulk  
- Avoid manual repetition in the UI  

---

## ⚠️ Important

- Make sure your CSV is correct before running  
- Use **Dry Run mode** first to test safely  
- Ensure you have the correct permissions in the system  
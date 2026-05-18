# 🧠 Advanced Provider Update Automation

This script performs automated updates across multiple providers using a CSV input and optional advanced step logic.

---

## 🔍 What this script does

- Logs into the system using your secure credentials  
- Reads a CSV file containing ODS Codes  
- Loops through each provider in the CSV  
- Navigates to the provider and performs updates  
- Optionally executes **custom advanced steps** per row  

---

## ⚙️ Core Features

### 📄 CSV-Driven Execution
- Reads input from a CSV file (`CSV_PATH`)
- Supports flexible column naming (e.g. `odsCode`, `ODSCode`, `ODS`)
- Processes each row independently

---

### 🔐 Secure Authentication
- Uses encrypted `.enc` credentials  
- Supports MFA (token-based login)  
- Automatically logs into the correct region per provider  

---

### 🧩 Advanced Step Engine

You can provide custom step instructions using the **Advanced Steps** field.

These steps are:

- Parsed dynamically  
- Resolved with CSV data (e.g. `{{odsCode}}`)  
- Executed per row  

---

### 🔁 Token Replacement

Advanced steps support dynamic tokens:
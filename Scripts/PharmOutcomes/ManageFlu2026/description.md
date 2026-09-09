# 💉 Manage Flu 2026

Automates PharmOutcomes Flu campaign administration by processing providers directly from a CSV file using fast, URL-driven actions.

## 📋 Requirements

Before running the script, you will need:

### Environment Variables

- **SERVICEID**
    The Flu service to accredit providers against

- **COMMISSIONERID**
    The commissioner to add/remove

- **INPUT_CSV_PATH**
    Path to the campaign CSV file

### CSV Requirements

The CSV must contain, at minimum:

### Required CSV Fields

- **SysID**  
  PharmOutcomes Provider ID

- **ODSCode**  
  Pharmacy ODS code used for reporting and logging

- **AddOrRemove**  
  Action to perform (`Add` or `Remove`)

Example:

```csv
| SysID | ODSCode | AddOrRemove |
|-------|---------|-------------|
| 36011 | FGY24   | Add         |
| 40941 | FYW42   | Remove      |
| 43038 | FX500   | Add         |
```

## 🚀 Process Flow

Login  
↓  
Capture Session Token  
↓  
Read Campaign CSV  
↓  
Process Providers  
&nbsp;&nbsp;&nbsp;&nbsp;↳ ➕ Accredit Service  
&nbsp;&nbsp;&nbsp;&nbsp;↳ ➖ Remove Commissioner  
↓  
Generate Reports  
↓  
Display Run Summary
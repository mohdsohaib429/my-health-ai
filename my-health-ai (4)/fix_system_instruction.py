import re

with open('server.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace using regex to match the weird bullet
new_rule = """
    - Step 6: Food Log Correction Rule: 
      • If a user explicitly asks to correct/update an existing entry, identify it, set intent to "UPDATE_FOOD", include 'sheetRowNumber', and recalculate.
    - Step 7: Safety rules:
      • Never overwrite or modify an existing Food Database entry without asking first."""

# Use a broad regex to match Step 6
pattern = r'(\s+- Step 6: Safety rules:)\s+.*Never overwrite or modify an existing Food Database entry without asking first\.'
new_content = re.sub(pattern, new_rule, content)

with open('server.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)

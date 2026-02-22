with open('src/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Keep lines 0-12 (indices 0-12, which is lines 1-13)
new_lines = lines[:13]

# Add new regular imports
new_lines.append("import { EstimateManager } from './components/EstimateManager';\n")
new_lines.append("import { TemplatesManager } from './components/Templates';\n")
new_lines.append("import { ChecklistsManager } from './components/Checklists';\n")
new_lines.append("import { StaffManager } from './components/StaffManager';\n")
new_lines.append("import { GoalsManager } from './components/GoalsManager';\n")
new_lines.append("import { PDFSettings } from './components/PDFSettings';\n")
new_lines.append("import { EventCalendar } from './components/EventCalendar';\n")
new_lines.append("import { Analytics } from './components/Analytics';\n")
new_lines.append("import { CustomersManager } from './components/CustomersManager';\n")
new_lines.append("import { AdminPanel } from './components/AdminPanel';\n")
new_lines.append("import { AccessDenied } from './components/AccessDenied';\n")

# Skip lines 13-24 (old lazy imports, which is indices 13-24) and add the rest from line 25
new_lines.extend(lines[25:])

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Fixed lazy imports!')

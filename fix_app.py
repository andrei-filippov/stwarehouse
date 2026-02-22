import re

with open('src/App.tsx', 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Replace lazy imports with regular imports
old_pattern = r"// Lazy loading.*\nconst EstimateManager = lazy\(\(\) => import\('\./components/EstimateManager'\)\.then\(m => \(\{ default: m\.EstimateManager \}\)\)\);\nconst TemplatesManager = lazy\(\(\) => import\('\./components/Templates'\)\.then\(m => \(\{ default: m\.TemplatesManager \}\)\)\);\nconst ChecklistsManager = lazy\(\(\) => import\('\./components/Checklists'\)\.then\(m => \(\{ default: m\.ChecklistsManager \}\)\)\);\nconst StaffManager = lazy\(\(\) => import\('\./components/StaffManager'\)\.then\(m => \(\{ default: m\.StaffManager \}\)\)\);\nconst GoalsManager = lazy\(\(\) => import\('\./components/GoalsManager'\)\.then\(m => \(\{ default: m\.GoalsManager \}\)\)\);\nconst PDFSettings = lazy\(\(\) => import\('\./components/PDFSettings'\)\.then\(m => \(\{ default: m\.PDFSettings \}\)\)\);\nconst EventCalendar = lazy\(\(\) => import\('\./components/EventCalendar'\)\.then\(m => \(\{ default: m\.EventCalendar \}\)\)\);\nconst Analytics = lazy\(\(\) => import\('\./components/Analytics'\)\.then\(m => \(\{ default: m\.Analytics \}\)\)\);\nconst CustomersManager = lazy\(\(\) => import\('\./components/CustomersManager'\)\.then\(m => \(\{ default: m\.CustomersManager \}\)\)\);\nconst AdminPanel = lazy\(\(\) => import\('\./components/AdminPanel'\)\.then\(m => \(\{ default: m\.AdminPanel \}\)\)\);\nconst AccessDenied = lazy\(\(\) => import\('\./components/AccessDenied'\)\.then\(m => \(\{ default: m\.AccessDenied \}\)\)\);"

new_imports = """import { EstimateManager } from './components/EstimateManager';
import { TemplatesManager } from './components/Templates';
import { ChecklistsManager } from './components/Checklists';
import { StaffManager } from './components/StaffManager';
import { GoalsManager } from './components/GoalsManager';
import { PDFSettings } from './components/PDFSettings';
import { EventCalendar } from './components/EventCalendar';
import { Analytics } from './components/Analytics';
import { CustomersManager } from './components/CustomersManager';
import { AdminPanel } from './components/AdminPanel';
import { AccessDenied } from './components/AccessDenied';"""

content = re.sub(old_pattern, new_imports, content)

# Remove duplicate AccessDenied import at the end
content = re.sub(r"import \{ AccessDenied \} from '\./components/AccessDenied';\n\nfunction App", "function App", content)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed!')

import subprocess
import re

# Get good version from 74e122bb
content = subprocess.check_output(['git', 'show', '74e122bb:src/App.tsx'])
text = content.decode('utf-8')

# Check if it has lazy imports
if 'lazy' in text:
    print('Has lazy imports - need to fix')
    
    # Replace lazy imports with regular imports
    # Pattern for lazy imports
    pattern = r"const (\w+) = lazy\(\(\) => import\('([^']+)'\)\.then\(m => \({ default: m\.(\w+) }\)\)\);"
    
    def replace_lazy(match):
        export_name = match.group(3)
        path = match.group(2)
        return f"import {{ {export_name} }} from '{path}';"
    
    # Replace all lazy imports
    new_text = re.sub(pattern, replace_lazy, text)
    
    # Remove lazy from react imports
    new_text = new_text.replace("import { lazy, Suspense } from 'react';\n", "import { Suspense } from 'react';\n")
    new_text = new_text.replace("import { lazy } from 'react';\n", "")
    new_text = new_text.replace("import { lazy, ", "import { ")
    
    # Verify
    if 'lazy' not in new_text:
        print('Lazy imports removed successfully')
    else:
        print('WARNING: Still has lazy imports')
        for i, line in enumerate(new_text.split('\n'), 1):
            if 'lazy' in line:
                print(f'  Line {i}: {line[:80]}')
    
    # Save
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print('Saved to src/App.tsx')
else:
    print('No lazy imports - already good')
    with open('src/App.tsx', 'wb') as f:
        f.write(content)

from zipfile import ZipFile
import xml.etree.ElementTree as ET
import re

def read_docx(filename):
    with ZipFile(filename, 'r') as z:
        xml_content = z.read('word/document.xml')
    
    # Парсим XML
    root = ET.fromstring(xml_content)
    
    # Находим все параграфы
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    
    paragraphs = []
    for p in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
        texts = []
        for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
            if t.text:
                texts.append(t.text)
        if texts:
            paragraphs.append(''.join(texts))
    
    return '\n'.join(paragraphs)

text = read_docx('Договор 4-26У от 3 марта 2026.docx')

# Сохраняем в файл
with open('contract_text.txt', 'w', encoding='utf-8') as f:
    f.write(text)

print('Contract text saved to contract_text.txt')

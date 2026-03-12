const fs = require('fs');

// Создаем SVG иконку
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2563eb" rx="80"/>
  <g transform="translate(256, 256)">
    <!-- Коробка -->
    <rect x="-80" y="-60" width="160" height="120" fill="white" rx="8"/>
    <rect x="-80" y="-60" width="160" height="30" fill="#e5e7eb" rx="8"/>
    <rect x="-10" y="-60" width="20" height="120" fill="#e5e7eb"/>
    <!-- Галочка -->
    <path d="M-40 10 L-10 40 L50 -20" stroke="#2563eb" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

// Простая функция для создания PNG (заглушка - в реальности нужен canvas)
// Создадаим data URI для SVG
const svgBase64 = Buffer.from(svgIcon).toString('base64');
const svgDataUri = `data:image/svg+xml;base64,${svgBase64}`;

console.log('SVG иконка создана');
console.log('Data URI:', svgDataUri.substring(0, 100) + '...');

// Сохраняем SVG
fs.writeFileSync('public/icon.svg', svgIcon);
console.log('Сохранено: public/icon.svg');

// Создаем HTML файл с canvas для генерации PNG
const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Generate Icons</title>
</head>
<body>
  <canvas id="canvas192" width="192" height="192"></canvas>
  <canvas id="canvas512" width="512" height="512"></canvas>
  <script>
    const svgData = \`${svgIcon}\`;
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    
    function drawIcon(canvasId, size) {
      const canvas = document.getElementById(canvasId);
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size, size);
        const pngUrl = canvas.toDataURL('image/png');
        console.log(canvasId + ':' + pngUrl);
      };
      img.src = url;
    }
    
    drawIcon('canvas192', 192);
    drawIcon('canvas512', 512);
  </script>
</body>
</html>`;

fs.writeFileSync('generate-icons.html', htmlContent);
console.log('Сохранено: generate-icons.html');
console.log('Откройте этот файл в браузере и скопируйте base64 данные иконок');

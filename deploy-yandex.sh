#!/bin/bash
# =============================================================================
# Деплой фронтенда в Yandex Object Storage (ручной запуск)
# =============================================================================
# Использование:
#   ./deploy-yandex.sh           # Деплой текущей ветки
#   ./deploy-yandex.sh --build   # Сначала сборка, потом деплой
# =============================================================================

set -e

# Конфигурация
BUCKET_NAME="stwarehouse"
ENDPOINT_URL="https://storage.yandexcloud.net"
DIST_DIR="./dist"

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Деплой в Yandex Object Storage${NC}"
echo -e "${BLUE}  Бакет: ${BUCKET_NAME}${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"

# Проверка наличия AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI не установлен${NC}"
    echo "Установите: pip install awscli"
    exit 1
fi

# Проверка наличия профиля yandex
if ! aws configure list-profiles | grep -q "yandex"; then
    echo -e "${YELLOW}⚠️ Профиль 'yandex' не найден${NC}"
    echo "Настройте: aws configure --profile yandex"
    echo "  Access Key ID: <your_key>"
    echo "  Secret Access Key: <your_secret>"
    echo "  Region: ru-central1"
    exit 1
fi

# Опциональная сборка
if [[ "$1" == "--build" ]]; then
    echo -e "\n${YELLOW}🔨 Сборка проекта...${NC}"
    npm ci
    npm run build
fi

# Проверка наличия dist
if [ ! -d "$DIST_DIR" ]; then
    echo -e "${RED}❌ Папка ${DIST_DIR} не найдена${NC}"
    echo "Сначала выполните сборку: npm run build"
    echo "Или запустите: ./deploy-yandex.sh --build"
    exit 1
fi

echo -e "\n${YELLOW}📤 Загрузка статических файлов...${NC}"

# Статика с длительным кешем
echo -e "${BLUE}  → assets (кеш 1 год)${NC}"
aws s3 --profile yandex --endpoint-url=$ENDPOINT_URL \
    sync $DIST_DIR s3://$BUCKET_NAME \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "index.html" \
    --exclude "sw.js" \
    --exclude "manifest.json"

# Файлы без кеша
echo -e "${BLUE}  → index.html (без кеша)${NC}"
aws s3 --profile yandex --endpoint-url=$ENDPOINT_URL \
    cp $DIST_DIR/index.html s3://$BUCKET_NAME/index.html \
    --cache-control "public, max-age=0, must-revalidate"

echo -e "${BLUE}  → sw.js (без кеша)${NC}"
aws s3 --profile yandex --endpoint-url=$ENDPOINT_URL \
    cp $DIST_DIR/sw.js s3://$BUCKET_NAME/sw.js \
    --cache-control "public, max-age=0, must-revalidate"

echo -e "${BLUE}  → manifest.json (без кеша)${NC}"
aws s3 --profile yandex --endpoint-url=$ENDPOINT_URL \
    cp $DIST_DIR/manifest.json s3://$BUCKET_NAME/manifest.json \
    --cache-control "public, max-age=0, must-revalidate"

echo -e "\n${GREEN}✅ Деплой в Yandex Object Storage завершён!${NC}"
echo -e "${GREEN}🌐 https://${BUCKET_NAME}.website.yandexcloud.net${NC}"
echo -e "\n${YELLOW}💡 Vercel деплоится автоматически при push в main${NC}"

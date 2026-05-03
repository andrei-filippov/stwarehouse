#!/bin/bash
set -e

echo "🚀 Деплой Supabase Proxy в Yandex Cloud"
echo "=========================================="

# Проверяем наличие Yandex CLI
if ! command -v yc &> /dev/null; then
    echo "❌ Yandex CLI (yc) не найден"
    echo "Установите: https://cloud.yandex.ru/docs/cli/quickstart"
    exit 1
fi

# Проверяем авторизацию
echo "🔑 Проверка авторизации..."
yc config get token > /dev/null 2>&1 || {
    echo "❌ Не авторизован. Запустите: yc init"
    exit 1
}

# Параметры
FUNCTION_NAME="proxy-supabase"
API_GATEWAY_NAME="supabase-proxy"
RUNTIME="python312"
MEMORY="128m"
TIMEOUT="30s"

# Загружаем переменные из .env если есть
if [ -f ../.env ]; then
    echo "📄 Загружаем переменные из .env..."
    export $(grep -E '^(SUPABASE_URL|SUPABASE_ANON_KEY)=' ../.env | xargs)
fi

# Проверяем переменные
if [ -z "$SUPABASE_URL" ]; then
    read -p "Введите SUPABASE_URL (например https://xxx.supabase.co): " SUPABASE_URL
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
    read -sp "Введите SUPABASE_ANON_KEY (JWT anon key): " SUPABASE_ANON_KEY
    echo
fi

echo ""
echo "📋 Конфигурация:"
echo "  SUPABASE_URL: $SUPABASE_URL"
echo "  FUNCTION_NAME: $FUNCTION_NAME"
echo "  API_GATEWAY_NAME: $API_GATEWAY_NAME"
echo ""

# Создаём или обновляем функцию
echo "📦 Создание/обновление Cloud Function..."
if yc serverless function get --name=$FUNCTION_NAME > /dev/null 2>&1; then
    echo "  Функция $FUNCTION_NAME уже существует, обновляем версию..."
else
    echo "  Создаём новую функцию $FUNCTION_NAME..."
    yc serverless function create --name=$FUNCTION_NAME
fi

# Создаём версию функции
echo "  Загружаем код функции..."
yc serverless function version create \
    --function-name=$FUNCTION_NAME \
    --runtime=$RUNTIME \
    --entrypoint=index.handler \
    --memory=$MEMORY \
    --execution-timeout=$TIMEOUT \
    --source-path=./proxy-supabase \
    --environment="SUPABASE_URL=${SUPABASE_URL},SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}" \
    --description="Auto-deploy $(date +%Y-%m-%d_%H:%M:%S)"

# Получаем ID функции
FUNCTION_ID=$(yc serverless function get --name=$FUNCTION_NAME --format=json | grep -o '"id": "[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Function ID: $FUNCTION_ID"

# Создаём или обновляем API Gateway
echo ""
echo "🌐 Создание/обновление API Gateway..."

# Подготавливаем спецификацию с реальными ID
SERVICE_ACCOUNT_ID=$(yc iam service-account get --name=default --format=json 2>/dev/null | grep -o '"id": "[^"]*"' | head -1 | cut -d'"' -f4 || echo "")

if [ -z "$SERVICE_ACCOUNT_ID" ]; then
    echo "  ⚠️  Не удалось получить ID сервисного аккаунта. Используем пустое значение."
    SERVICE_ACCOUNT_ID=""
fi

# Заменяем переменные в спецификации
sed -e "s/\${PROXY_FUNCTION_ID}/$FUNCTION_ID/g" \
    -e "s/\${SERVICE_ACCOUNT_ID}/$SERVICE_ACCOUNT_ID/g" \
    api-gateway-spec.yaml > api-gateway-spec-deploy.yaml

if yc serverless api-gateway get --name=$API_GATEWAY_NAME > /dev/null 2>&1; then
    echo "  API Gateway $API_GATEWAY_NAME уже существует, обновляем..."
    yc serverless api-gateway update \
        --name=$API_GATEWAY_NAME \
        --spec=api-gateway-spec-deploy.yaml
else
    echo "  Создаём новый API Gateway $API_GATEWAY_NAME..."
    yc serverless api-gateway create \
        --name=$API_GATEWAY_NAME \
        --spec=api-gateway-spec-deploy.yaml
fi

# Получаем URL API Gateway
echo ""
echo "✅ Деплой завершён!"
echo ""

GATEWAY_URL=$(yc serverless api-gateway get --name=$API_GATEWAY_NAME --format=json | grep -o '"domain": "[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$GATEWAY_URL" ]; then
    echo "🌐 URL вашего прокси:"
    echo "   https://${GATEWAY_URL}/proxy"
    echo ""
    echo "📝 Обновите VITE_SUPABASE_URL в .env и GitHub Secrets:"
    echo "   VITE_SUPABASE_URL=https://${GATEWAY_URL}/proxy"
else
    echo "⚠️  Не удалось получить URL API Gateway. Проверьте в консоли Yandex Cloud."
fi

# Удаляем временный файл
rm -f api-gateway-spec-deploy.yaml

echo ""
echo "🎉 Готово!"

import json
import os
import urllib.request
import urllib.error
from urllib.parse import urlencode

# Конфигурация из переменных окружения
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')

# Разрешённые origins для CORS
ALLOWED_ORIGINS = [
    'https://stwarehouse.website.yandexcloud.net',
    'https://stwarehouse.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
]


def get_cors_headers(origin=None):
    """Возвращает CORS заголовки."""
    allowed_origin = origin if origin in ALLOWED_ORIGINS else ALLOWED_ORIGINS[0]
    return {
        'Access-Control-Allow-Origin': allowed_origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, prefer, range',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
    }


def handler(event, context):
    """
    Yandex Cloud Function handler.
    Проксирует запросы к Supabase REST API.
    
    Ожидает пути вида:
      /rest/v1/table?select=*        (прямой путь)
      /proxy/rest/v1/table?select=*  (с префиксом /proxy)
    """
    http_method = event.get('httpMethod', 'GET')
    headers = {k.lower(): v for k, v in event.get('headers', {}).items()}
    origin = headers.get('origin', '')
    
    # Обработка preflight OPTIONS запроса
    if http_method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': get_cors_headers(origin),
            'body': ''
        }
    
    # Проверяем конфигурацию
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return {
            'statusCode': 500,
            'headers': {**get_cors_headers(origin), 'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Proxy not configured: missing SUPABASE_URL or SUPABASE_ANON_KEY'})
        }
    
    # Получаем путь из запроса
    path = event.get('path', '')
    query_params = event.get('queryStringParameters', {}) or {}
    
    # Убираем префикс /proxy если есть
    if path.startswith('/proxy'):
        path = path[len('/proxy'):]
    
    # Убеждаемся что путь начинается с /
    if not path.startswith('/'):
        path = '/' + path
    
    # Строим полный URL к Supabase
    # Путь уже должен содержать /rest/v1/...
    query_string = ''
    if query_params:
        query_string = '?' + urlencode(query_params, doseq=True)
    
    target_url = f"{SUPABASE_URL.rstrip('/')}{path}{query_string}"
    
    # Подготавливаем заголовки для Supabase
    req_headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': headers.get('content-type', 'application/json'),
        'Accept': headers.get('accept', 'application/json'),
    }
    
    # Прокидываем Authorization заголовок (JWT токен пользователя)
    auth_header = headers.get('authorization')
    if auth_header:
        req_headers['Authorization'] = auth_header
    else:
        req_headers['Authorization'] = f'Bearer {SUPABASE_ANON_KEY}'
    
    # Прокидываем дополнительные заголовки Supabase
    for key in ['x-client-info', 'prefer', 'range']:
        if key in headers:
            req_headers[key] = headers[key]
    
    # Получаем тело запроса
    body = event.get('body', '')
    is_base64 = event.get('isBase64Encoded', False)
    
    if is_base64 and body:
        import base64
        body = base64.b64decode(body).decode('utf-8')
    
    try:
        # Создаём запрос к Supabase
        req = urllib.request.Request(
            target_url,
            method=http_method,
            headers=req_headers,
        )
        
        if body and http_method in ['POST', 'PUT', 'PATCH']:
            req.data = body.encode('utf-8') if isinstance(body, str) else body
        
        # Выполняем запрос
        response = urllib.request.urlopen(req, timeout=30)
        
        # Читаем ответ
        response_body = response.read().decode('utf-8')
        response_headers = dict(response.headers)
        
        # Формируем ответ
        result_headers = get_cors_headers(origin)
        
        # Прокидываем важные заголовки от Supabase
        for h in ['content-type', 'content-range', 'x-total-count', 'preference-applied']:
            if h in response_headers:
                result_headers[h] = response_headers[h]
        
        return {
            'statusCode': response.status,
            'headers': result_headers,
            'body': response_body
        }
        
    except urllib.error.HTTPError as e:
        # Ошибки HTTP (4xx, 5xx)
        error_body = e.read().decode('utf-8') if e.fp else json.dumps({'error': str(e)})
        
        return {
            'statusCode': e.code,
            'headers': {**get_cors_headers(origin), 'Content-Type': 'application/json'},
            'body': error_body
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {**get_cors_headers(origin), 'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'Proxy error: {str(e)}', 'target_url': target_url})
        }

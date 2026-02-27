// Supabase Edge Function: parse-rider
// Анализирует технический райдер через GigaChat API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GIGACHAT_API_URL = 'https://gigachat.devices.sberbank.ru/api/v1';
const GIGACHAT_SCOPE = 'GIGACHAT_API_PERS';

// CORS заголовки
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Генерация UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Получение токена GigaChat
async function getGigaChatToken(clientId: string, clientSecret: string): Promise<string> {
  const authString = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch(`${GIGACHAT_API_URL}/oauth`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'RqUID': generateUUID(),
    },
    body: `scope=${GIGACHAT_SCOPE}`,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GigaChat auth failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Парсинг райдера через GigaChat
async function parseRiderWithGigaChat(
  riderText: string, 
  clientId: string, 
  clientSecret: string
): Promise<any> {
  const token = await getGigaChatToken(clientId, clientSecret);

  const systemPrompt = `Ты - технический специалист по звуковому и световому оборудованию. 
Твоя задача - проанализировать технический райдер артиста и извлечь из него список оборудования.

Ответь строго в формате JSON без Markdown разметки:
{
  "event_name": "Название мероприятия или артист (если есть)",
  "venue": "Площадка (если указана)",
  "event_date": "Дата в формате YYYY-MM-DD (если указана)",
  "items": [
    {
      "name": "Точное название оборудования",
      "quantity": число,
      "category": "одна из: Звук, Свет, Сцена, Кабель, Инструмент, Другое",
      "description": "Дополнительные характеристики"
    }
  ]
}

Правила:
1. Если количество не указано - ставь 1
2. Разделяй комплекты на отдельные позиции
3. Категоризируй: микрофоны, микшеры, усилители → Звук; прожекторы, LED → Свет
4. Если не уверен в категории - ставь "Другое"
5. Сохраняй оригинальные названия оборудования из райдера`;

  const response = await fetch(`${GIGACHAT_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'GigaChat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Вот технический райдер:\n\n${riderText}` }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GigaChat API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '{}';
  
  // Очищаем от Markdown
  const cleanJson = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanJson);
    return {
      event_name: parsed.event_name || '',
      venue: parsed.venue || '',
      event_date: parsed.event_date || '',
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch (e) {
    throw new Error('Неверный формат ответа от GigaChat');
  }
}

// Главный обработчик
serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Проверяем метод
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Получаем данные запроса
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { riderText } = body;

    if (!riderText || typeof riderText !== 'string') {
      return new Response(
        JSON.stringify({ error: 'riderText is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Получаем ключи из переменных окружения (безопасно!)
    const clientId = Deno.env.get('GIGACHAT_CLIENT_ID');
    const clientSecret = Deno.env.get('GIGACHAT_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'GigaChat credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Парсим райдер
    const result = await parseRiderWithGigaChat(riderText, clientId, clientSecret);

    // Возвращаем результат
    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=300' // Кэш 5 минут
        } 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        items: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

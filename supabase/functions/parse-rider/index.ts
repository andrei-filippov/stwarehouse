// Supabase Edge Function: parse-rider
// Анализирует технический райдер через GigaChat API (через OpenRouter)
// https://openrouter.ai/docs

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'gigachat/gigachat-pro'; // Можно заменить на 'gigachat/gigachat-lite' для экономии

// CORS заголовки
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Парсинг райдера через OpenRouter (GigaChat)
async function parseRiderWithAI(
  riderText: string, 
  apiKey: string
): Promise<any> {
  console.log('Parsing rider via OpenRouter, text length:', riderText.length);

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

  console.log('Sending request to OpenRouter...');
  
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://stwarehouse.vercel.app', // Укажите ваш домен
      'X-Title': 'ST Warehouse - Rider Parser',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Вот технический райдер:\n\n${riderText}` }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  console.log('OpenRouter response status:', response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('OpenRouter error:', errorData);
    throw new Error(`OpenRouter API error: ${response.status} - ${errorData.error?.message || errorData.error || 'Unknown'}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  
  console.log('Response received, parsing...');
  
  // Очищаем от Markdown
  const cleanJson = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanJson);
    console.log('Parsed successfully, items:', parsed.items?.length || 0);
    
    return {
      event_name: parsed.event_name || '',
      venue: parsed.venue || '',
      event_date: parsed.event_date || '',
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch (e) {
    console.error('JSON parse error, raw content:', content.substring(0, 500));
    throw new Error('Неверный формат ответа от AI');
  }
}

// Главный обработчик
serve(async (req) => {
  console.log('=== Request ===', req.method);
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { riderText } = body;

    if (!riderText || typeof riderText !== 'string') {
      return new Response(
        JSON.stringify({ error: 'riderText required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');

    console.log('API Key check:', { hasKey: !!apiKey, keyPrefix: apiKey?.substring(0, 10) + '...' });

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await parseRiderWithAI(riderText, apiKey);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
        } 
      }
    );

  } catch (error) {
    console.error('=== Error ===', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        items: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

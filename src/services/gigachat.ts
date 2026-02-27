// GigaChat API Service
// Документация: https://developers.sber.ru/docs/ru/gigachat/overview

const GIGACHAT_API_URL = 'https://gigachat.devices.sberbank.ru/api/v1';

export interface GigaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GigaChatResponse {
  choices: {
    message: {
      role: string;
      content: string;
    };
    index: number;
    finish_reason: string;
  }[];
  created: number;
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ParsedRider {
  event_name?: string;
  venue?: string;
  event_date?: string;
  items: {
    name: string;
    quantity: number;
    category?: string;
    description?: string;
  }[];
}

class GigaChatService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private scope: string = 'GIGACHAT_API_PERS'
  ) {}

  // Получение токена доступа
  private async getAccessToken(): Promise<string> {
    // Если токен ещё валиден (с запасом в 60 секунд), используем его
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    const authString = btoa(`${this.clientId}:${this.clientSecret}`);
    
    const response = await fetch(`${GIGACHAT_API_URL}/oauth`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'RqUID': this.generateUUID(),
      },
      body: `scope=${this.scope}`,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get access token: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    // expires_in в секундах, конвертируем в timestamp
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    
    return this.accessToken;
  }

  // Генерация UUID для RqUID
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Отправка сообщений в GigaChat
  async chat(messages: GigaChatMessage[], model: string = 'GigaChat'): Promise<GigaChatResponse> {
    const token = await this.getAccessToken();

    const response = await fetch(`${GIGACHAT_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3, // Низкая температура для более точных ответов
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GigaChat API error: ${error}`);
    }

    return response.json();
  }

  // Парсинг райдера через GigaChat
  async parseRider(riderText: string): Promise<ParsedRider> {
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
      "description": "Дополнительные характеристики (мощность, размер, и т.д.)"
    }
  ]
}

Правила:
1. Если количество не указано - ставь 1
2. Разделяй комплекты на отдельные позиции (например, "2 монитора" → две записи по 1 или одна запись с quantity: 2)
3. Категоризируй: микрофоны, микшеры, усилители → Звук; прожекторы, LED → Свет; стойки, подиумы → Сцена
4. Если не уверен в категории - ставь "Другое"
5. Сохраняй оригинальные названия оборудования из райдера`;

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Вот технический райдер:\n\n${riderText}` }
    ]);

    const content = response.choices[0]?.message?.content || '{}';
    
    // Очищаем от Markdown разметки если есть
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
      console.error('Failed to parse GigaChat response:', content);
      throw new Error('Неверный формат ответа от GigaChat. Попробуйте ещё раз или введите данные вручную.');
    }
  }

  // Сопоставление извлечённого оборудования с базой
  async matchWithInventory(
    riderItems: { name: string; quantity: number; category?: string; description?: string }[],
    inventory: { name: string; category: string; price: number; unit: string; id?: string }[]
  ): Promise<{
    matched: { riderItem: any; inventoryItem: any; confidence: number }[];
    unmatched: any[];
  }> {
    const systemPrompt = `Ты - помощник по сопоставлению оборудования. 
Сопоставь позиции из райдера с оборудованием из базы.

Ответь строго в формате JSON:
{
  "matches": [
    {
      "rider_index": номер позиции из райдера (0-based),
      "inventory_index": номер позиции из базы или -1 если нет совпадения,
      "confidence": число от 0 до 1 (уверенность в совпадении)
    }
  ]
}

Правила сопоставления:
1. Сравнивай по названию и категории
2. Учитывай синонимы ("микрофон" ≈ "mic", "вокальный микрофон")
3. Если точного совпадения нет - confidence 0 и inventory_index -1
4. Confidence > 0.7 только при уверенном совпадении`;

    const prompt = `Оборудование из райдера:\n${JSON.stringify(riderItems, null, 2)}\n\nОборудование из базы:\n${JSON.stringify(inventory, null, 2)}`;

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]);

    const content = response.choices[0]?.message?.content || '{}';
    const cleanJson = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      const parsed = JSON.parse(cleanJson);
      const matches = parsed.matches || [];
      
      const matched: { riderItem: any; inventoryItem: any; confidence: number }[] = [];
      const unmatched: any[] = [];

      riderItems.forEach((item, index) => {
        const match = matches.find((m: any) => m.rider_index === index);
        if (match && match.inventory_index >= 0 && match.confidence > 0.5) {
          matched.push({
            riderItem: item,
            inventoryItem: inventory[match.inventory_index],
            confidence: match.confidence,
          });
        } else {
          unmatched.push(item);
        }
      });

      return { matched, unmatched };
    } catch (e) {
      console.error('Failed to parse matching response:', content);
      // Возвращаем всё как unmatched
      return { matched: [], unmatched: riderItems };
    }
  }
}

export default GigaChatService;

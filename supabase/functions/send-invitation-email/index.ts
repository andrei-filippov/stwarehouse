import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const UNISENDER_API_KEY = Deno.env.get('UNISENDER_API_KEY')
const API_KEY = Deno.env.get('INVITATION_API_KEY') // Добавь этот секрет в Supabase

// CORS заголовки
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Обрабатываем OPTIONS запрос (preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Проверяем API ключ (простая защита от спама)
    const authHeader = req.headers.get('authorization')
    const apiKeyHeader = req.headers.get('x-api-key')
    
    // Принимаем либо Supabase токен, либо API ключ
    const isValidAuth = authHeader?.startsWith('Bearer ') || apiKeyHeader === API_KEY
    
    if (!isValidAuth) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!UNISENDER_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'UNISENDER_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, companyName, invitedBy, role } = await req.json()

    if (!email || !companyName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const subject = `Вас пригласили в компанию "${companyName}"`
    const bodyText = `Здравствуйте!

Вас пригласили присоединиться к компании "${companyName}" в системе СкладОборуд.

Роль: ${role === 'manager' ? 'Менеджер' : role === 'admin' ? 'Администратор' : role === 'accountant' ? 'Бухгалтер' : 'Наблюдатель'}
Пригласил: ${invitedBy}

Для входа: https://stwarehouse.vercel.app

Если у вас еще нет аккаунта - зарегистрируйтесь с этим email (${email}).

С уважением,
Команда СкладОборуд`

    const params = new URLSearchParams({
      format: 'json',
      api_key: UNISENDER_API_KEY,
      email: email,
      sender_name: 'СкладОборуд',
      sender_email: 'noreply@stwarehouse.ru',
      subject: subject,
      body: bodyText,
      list_id: '1'
    })

    const response = await fetch('https://api.unisender.com/ru/api/sendEmail?' + params.toString())
    const result = await response.json()

    if (result.error) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

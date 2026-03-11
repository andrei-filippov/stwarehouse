import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Берем ключ из зашифрованных секретов Supabase
const UNISENDER_API_KEY = Deno.env.get('UNISENDER_API_KEY')

serve(async (req) => {
  try {
    // Проверяем что ключ настроен
    if (!UNISENDER_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'UNISENDER_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { email, companyName, invitedBy, role } = await req.json()

    if (!email || !companyName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Формируем текст письма
    const subject = `Вас пригласили в компанию "${companyName}"`
    const bodyText = `Здравствуйте!

Вас пригласили присоединиться к компании "${companyName}" в системе СкладОборуд.

Роль: ${role === 'manager' ? 'Менеджер' : role === 'admin' ? 'Администратор' : role === 'accountant' ? 'Бухгалтер' : 'Наблюдатель'}
Пригласил: ${invitedBy}

Для входа перейдите по ссылке: https://stwarehouse.vercel.app

Если у вас еще нет аккаунта - зарегистрируйтесь с этим email (${email}), и приглашение автоматически активируется.

С уважением,
Команда СкладОборуд`

    // Отправляем через Unisender API
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
      console.error('Unisender error:', result)
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

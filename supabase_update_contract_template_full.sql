-- ============================================
-- Обновление шаблона договора с полными реквизитами
-- ============================================
-- Инструкция: Выполните этот скрипт в Supabase Dashboard → SQL Editor
-- ============================================

-- Обновляем стандартный шаблон договора
UPDATE contract_templates 
SET content = '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { 
      font-family: "Times New Roman", Times, serif; 
      font-size: 12pt; 
      line-height: 1.5; 
      color: #000000 !important;
      background-color: #ffffff !important;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .underline { text-decoration: underline; }
    .contract-number { text-align: center; margin-bottom: 20px; }
    .parties { margin: 20px 0; text-align: justify; }
    .section { margin: 15px 0; }
    .section-title { font-weight: bold; text-transform: uppercase; margin: 10px 0; }
    .requisites { margin: 15px 0; }
    .requisites-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .requisites-table td { width: 50%; vertical-align: top; padding: 10px; border: 1px solid #000; }
    .signatures { margin-top: 50px; display: flex; justify-content: space-between; }
    .signature-block { width: 45%; }
    table.spec { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }
    table.spec th, table.spec td { border: 1px solid #000; padding: 5px; text-align: left; }
    table.spec th { background-color: #f0f0f0; }
    .bank-details { margin: 10px 0; font-size: 11pt; }
  </style>
</head>
<body>
  <div class="center bold" style="font-size: 14pt;">ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ</div>
  <div class="contract-number">№ {{contract_number}} от {{contract_date}}</div>
  
  <div class="parties">
    {{executor_name}}, именуемое в дальнейшем «Исполнитель», в лице {{executor_representative}}, 
    действующего на основании {{executor_basis}}, с одной стороны, и 
    {{customer_name}}, именуемое в дальнейшем «Заказчик», в лице {{customer_representative}}, 
    действующего на основании {{customer_basis}}, с другой стороны, вместе именуемые «Стороны», 
    заключили настоящий договор о нижеследующем:
  </div>

  <div class="section">
    <div class="section-title">1. Предмет договора</div>
    <p>1.1. По настоящему Договору Исполнитель обязуется по заданию Заказчика оказать услуги 
    по техническому оснащению мероприятия «{{event_name}}», {{event_date}}, с этой целью:</p>
    <p>— обеспечить звуковым и световым оборудованием в необходимой комплектации;</p>
    <p>— произвести монтаж и демонтаж оборудования;</p>
    <p>— обеспечить работу технических специалистов для сопровождения мероприятия.</p>
    <p>1.2. Заказчик обязуется принять и оплатить услуги согласно спецификации (Приложение № 1), 
    являющейся неотъемлемой частью настоящего Договора.</p>
  </div>

  <div class="section">
    <div class="section-title">2. Цена договора и порядок расчетов</div>
    <p>2.1. Стоимость услуг составляет {{total_amount}} ({{total_amount_text}}) рублей, НДС не облагается.</p>
    <p>2.2. {{payment_terms}}</p>
  </div>

  <div class="section">
    <div class="section-title">3. Сроки оказания услуг</div>
    <p>3.1. Услуги оказываются: {{event_date}}.</p>
    <p>3.2. Место оказания услуг: {{event_venue}}.</p>
  </div>

  <div class="section">
    <div class="section-title">4. Ответственность сторон</div>
    <p>4.1. Стороны несут ответственность за нарушение условий настоящего Договора 
    в соответствии с законодательством РФ.</p>
    <p>4.2. Сторона, не исполнившая или ненадлежащим образом исполнившая обязательства, 
    обязана возместить другой стороне причиненные убытки.</p>
  </div>

  <div class="section">
    <div class="section-title">5. Заключительные положения</div>
    <p>5.1. Настоящий Договор вступает в силу с момента подписания и действует до полного 
    исполнения сторонами своих обязательств.</p>
    <p>5.2. Договор составлен в двух экземплярах, имеющих одинаковую юридическую силу.</p>
    <p>5.3. Изменения и дополнения к Договору действительны при условии их письменного 
    оформления и подписания обеими Сторонами.</p>
  </div>

  <div style="page-break-before: always;">
    <div class="section-title">6. Реквизиты и подписи сторон</div>
    
    <table class="requisites-table">
      <tr>
        <td>
          <strong>ИСПОЛНИТЕЛЬ:</strong><br><br>
          <strong>{{executor_name}}</strong><br>
          ИНН: {{executor_inn}}<br>
          КПП: {{executor_kpp}}<br>
          ОГРН: {{executor_ogrn}}<br>
          Адрес: {{executor_address}}<br><br>
          
          <strong>Банковские реквизиты:</strong><br>
          Банк: {{executor_bank_name}}<br>
          БИК: {{executor_bank_bik}}<br>
          Р/с: {{executor_bank_account}}<br>
          К/с: {{executor_bank_corr_account}}<br><br>
          
          Тел.: {{executor_phone}}<br>
          E-mail: {{executor_email}}<br><br>
          
          <strong>Представитель:</strong><br>
          {{executor_representative}}<br><br>
          
          _________________ / _________________
        </td>
        <td>
          <strong>ЗАКАЗЧИК:</strong><br><br>
          <strong>{{customer_name}}</strong><br>
          ИНН: {{customer_inn}}<br>
          КПП: {{customer_kpp}}<br>
          ОГРН: {{customer_ogrn}}<br>
          Адрес: {{customer_address}}<br><br>
          
          <strong>Банковские реквизиты:</strong><br>
          Банк: {{customer_bank_name}}<br>
          БИК: {{customer_bank_bik}}<br>
          Р/с: {{customer_bank_account}}<br>
          К/с: {{customer_bank_corr_account}}<br><br>
          
          <strong>Представитель:</strong><br>
          {{customer_representative}}<br><br>
          
          _________________ / _________________
        </td>
      </tr>
    </table>
  </div>

  <div style="page-break-before: always;">
    <div class="center bold" style="font-size: 14pt; margin-bottom: 20px;">
      Приложение № 1
    </div>
    <div class="center" style="margin-bottom: 20px;">
      к Договору возмездного оказания услуг<br>
      № {{contract_number}} от {{contract_date}}
    </div>
    <div class="center bold" style="font-size: 13pt; margin-bottom: 15px;">
      СПЕЦИФИКАЦИЯ
    </div>
    
    {{specification_table}}
    
    <div style="margin-top: 30px; font-weight: bold;">
      Итого: {{total_amount}} руб.
    </div>
    
    <div style="margin-top: 40px;">
      <p>Согласовано:</p>
      <div class="signatures" style="margin-top: 20px;">
        <div class="signature-block">
          <p>От Исполнителя:</p>
          <p>_______________ / _______________</p>
        </div>
        <div class="signature-block">
          <p>От Заказчика:</p>
          <p>_______________ / _______________</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>'
WHERE type = 'service' AND is_default = TRUE;

-- Если шаблона нет - создаём новый
INSERT INTO contract_templates (name, type, content, description, is_default)
SELECT 
  'Договор возмездного оказания услуг (стандартный)',
  'service',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { 
      font-family: "Times New Roman", Times, serif; 
      font-size: 12pt; 
      line-height: 1.5; 
      color: #000000 !important;
      background-color: #ffffff !important;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .underline { text-decoration: underline; }
    .contract-number { text-align: center; margin-bottom: 20px; }
    .parties { margin: 20px 0; text-align: justify; }
    .section { margin: 15px 0; }
    .section-title { font-weight: bold; text-transform: uppercase; margin: 10px 0; }
    .requisites { margin: 15px 0; }
    .requisites-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .requisites-table td { width: 50%; vertical-align: top; padding: 10px; border: 1px solid #000; }
    .signatures { margin-top: 50px; display: flex; justify-content: space-between; }
    .signature-block { width: 45%; }
    table.spec { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }
    table.spec th, table.spec td { border: 1px solid #000; padding: 5px; text-align: left; }
    table.spec th { background-color: #f0f0f0; }
    .bank-details { margin: 10px 0; font-size: 11pt; }
  </style>
</head>
<body>
  <div class="center bold" style="font-size: 14pt;">ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ</div>
  <div class="contract-number">№ {{contract_number}} от {{contract_date}}</div>
  
  <div class="parties">
    {{executor_name}}, именуемое в дальнейшем «Исполнитель», в лице {{executor_representative}}, 
    действующего на основании {{executor_basis}}, с одной стороны, и 
    {{customer_name}}, именуемое в дальнейшем «Заказчик», в лице {{customer_representative}}, 
    действующего на основании {{customer_basis}}, с другой стороны, вместе именуемые «Стороны», 
    заключили настоящий договор о нижеследующем:
  </div>

  <div class="section">
    <div class="section-title">1. Предмет договора</div>
    <p>1.1. По настоящему Договору Исполнитель обязуется по заданию Заказчика оказать услуги 
    по техническому оснащению мероприятия «{{event_name}}», {{event_date}}, с этой целью:</p>
    <p>— обеспечить звуковым и световым оборудованием в необходимой комплектации;</p>
    <p>— произвести монтаж и демонтаж оборудования;</p>
    <p>— обеспечить работу технических специалистов для сопровождения мероприятия.</p>
    <p>1.2. Заказчик обязуется принять и оплатить услуги согласно спецификации (Приложение № 1), 
    являющейся неотъемлемой частью настоящего Договора.</p>
  </div>

  <div class="section">
    <div class="section-title">2. Цена договора и порядок расчетов</div>
    <p>2.1. Стоимость услуг составляет {{total_amount}} ({{total_amount_text}}) рублей, НДС не облагается.</p>
    <p>2.2. {{payment_terms}}</p>
  </div>

  <div class="section">
    <div class="section-title">3. Сроки оказания услуг</div>
    <p>3.1. Услуги оказываются: {{event_date}}.</p>
    <p>3.2. Место оказания услуг: {{event_venue}}.</p>
  </div>

  <div class="section">
    <div class="section-title">4. Ответственность сторон</div>
    <p>4.1. Стороны несут ответственность за нарушение условий настоящего Договора 
    в соответствии с законодательством РФ.</p>
    <p>4.2. Сторона, не исполнившая или ненадлежащим образом исполнившая обязательства, 
    обязана возместить другой стороне причиненные убытки.</p>
  </div>

  <div class="section">
    <div class="section-title">5. Заключительные положения</div>
    <p>5.1. Настоящий Договор вступает в силу с момента подписания и действует до полного 
    исполнения сторонами своих обязательств.</p>
    <p>5.2. Договор составлен в двух экземплярах, имеющих одинаковую юридическую силу.</p>
    <p>5.3. Изменения и дополнения к Договору действительны при условии их письменного 
    оформления и подписания обеими Сторонами.</p>
  </div>

  <div style="page-break-before: always;">
    <div class="section-title">6. Реквизиты и подписи сторон</div>
    
    <table class="requisites-table">
      <tr>
        <td>
          <strong>ИСПОЛНИТЕЛЬ:</strong><br><br>
          <strong>{{executor_name}}</strong><br>
          ИНН: {{executor_inn}}<br>
          КПП: {{executor_kpp}}<br>
          ОГРН: {{executor_ogrn}}<br>
          Адрес: {{executor_address}}<br><br>
          
          <strong>Банковские реквизиты:</strong><br>
          Банк: {{executor_bank_name}}<br>
          БИК: {{executor_bank_bik}}<br>
          Р/с: {{executor_bank_account}}<br>
          К/с: {{executor_bank_corr_account}}<br><br>
          
          Тел.: {{executor_phone}}<br>
          E-mail: {{executor_email}}<br><br>
          
          <strong>Представитель:</strong><br>
          {{executor_representative}}<br><br>
          
          _________________ / _________________
        </td>
        <td>
          <strong>ЗАКАЗЧИК:</strong><br><br>
          <strong>{{customer_name}}</strong><br>
          ИНН: {{customer_inn}}<br>
          КПП: {{customer_kpp}}<br>
          ОГРН: {{customer_ogrn}}<br>
          Адрес: {{customer_address}}<br><br>
          
          <strong>Банковские реквизиты:</strong><br>
          Банк: {{customer_bank_name}}<br>
          БИК: {{customer_bank_bik}}<br>
          Р/с: {{customer_bank_account}}<br>
          К/с: {{customer_bank_corr_account}}<br><br>
          
          <strong>Представитель:</strong><br>
          {{customer_representative}}<br><br>
          
          _________________ / _________________
        </td>
      </tr>
    </table>
  </div>

  <div style="page-break-before: always;">
    <div class="center bold" style="font-size: 14pt; margin-bottom: 20px;">
      Приложение № 1
    </div>
    <div class="center" style="margin-bottom: 20px;">
      к Договору возмездного оказания услуг<br>
      № {{contract_number}} от {{contract_date}}
    </div>
    <div class="center bold" style="font-size: 13pt; margin-bottom: 15px;">
      СПЕЦИФИКАЦИЯ
    </div>
    
    {{specification_table}}
    
    <div style="margin-top: 30px; font-weight: bold;">
      Итого: {{total_amount}} руб.
    </div>
    
    <div style="margin-top: 40px;">
      <p>Согласовано:</p>
      <div class="signatures" style="margin-top: 20px;">
        <div class="signature-block">
          <p>От Исполнителя:</p>
          <p>_______________ / _______________</p>
        </div>
        <div class="signature-block">
          <p>От Заказчика:</p>
          <p>_______________ / _______________</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>',
  'Стандартный шаблон договора на оказание услуг по техническому оснащению мероприятий',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM contract_templates WHERE type = 'service' AND is_default = TRUE
);

-- ============================================
-- Проверка
-- ============================================
SELECT 'Шаблон договора обновлён с полными реквизитами!' as status;

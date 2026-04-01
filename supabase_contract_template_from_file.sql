-- ============================================
-- Шаблон договора на основе файла "Договор 4-26У от 3 марта 2026"
-- ============================================
-- Инструкция: Выполните этот скрипт в Supabase Dashboard → SQL Editor
-- ============================================

-- Добавляем новый шаблон на основе файла
INSERT INTO contract_templates (name, type, content, description, is_default, company_id)
SELECT 
  'Договор возмездного оказания услуг (по файлу 4-26У)',
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
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header { text-align: center; margin-bottom: 20px; }
    .title { font-weight: bold; font-size: 14pt; text-transform: uppercase; }
    .subtitle { font-size: 12pt; margin-top: 5px; }
    .date-line { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .parties { margin: 20px 0; text-align: justify; }
    .section { margin: 15px 0; }
    .section-title { font-weight: bold; text-transform: uppercase; margin: 15px 0 10px 0; }
    .subsection { margin: 10px 0; }
    .requisites-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .requisites-table td { width: 50%; vertical-align: top; padding: 15px; border: 1px solid #000; }
    .signature-line { margin-top: 30px; }
    .spec-title { text-align: center; font-weight: bold; margin: 20px 0; }
    table.spec { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }
    table.spec th, table.spec td { border: 1px solid #000; padding: 5px; text-align: left; }
    table.spec th { background-color: #f0f0f0; font-weight: bold; }
    table.spec .category { background-color: #e3f2fd; font-weight: bold; }
    table.spec .total { font-weight: bold; text-align: right; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ № {{contract_number}}</div>
    <div class="date-line">
      <span>г. {{event_city}}</span>
      <span>{{contract_date}}</span>
    </div>
  </div>
  
  <div class="parties">
    {{executor_type}} {{executor_name}}, именуемый в дальнейшем «Исполнитель», с одной стороны, и 
    {{customer_type}} {{customer_name}}, в дальнейшем именуемый «Заказчик», с другой стороны, 
    вместе именуемые «Стороны», заключили настоящий договор о нижеследующем:
  </div>

  <div class="section">
    <div class="section-title">Предмет договора</div>
    <div class="subsection">
      По настоящему Договору Исполнитель обязуется по заданию Заказчика оказать ему Услуги по техническому обеспечению 
      {{event_name}}, с этой целью:
    </div>
    <div class="subsection">
      - обеспечить звуковым оборудование, в необходимой для проведения мероприятия комплектации;
    </div>
    <div class="subsection">
      - произвести монтаж и демонтаж оборудования;
    </div>
    <div class="subsection">
      - обеспечить работу технических специалистов для сопровождения мероприятия.
    </div>
    <div class="subsection">
      Заказчик обязуется принять и оплатить услуги согласно Приложению № 1 к настоящему Договору, 
      которое является неотъемлемой частью Договора.
    </div>
    <div class="subsection">
      Для оказания услуг Исполнитель вправе привлекать соисполнителей по своему выбору по согласованию с Заказчиком. 
      Использование работы соисполнителей не снимает ответственности с Исполнителя за качество оказываемых услуг.
    </div>
  </div>

  <div class="section">
    <div class="section-title">Цена договора и порядок оплаты</div>
    <div class="subsection">
      Стоимость оказываемых услуг составляет {{total_amount}} ({{total_amount_text}}) рублей, НДС не облагается.
    </div>
    <div class="subsection">
      Заказчик осуществляет оплату в следующем порядке: {{payment_terms}}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Права и обязанности сторон</div>
    <div class="subsection"><strong>Права и обязанности Исполнителя:</strong></div>
    <div class="subsection">Исполнитель обязуется обеспечить услуги надлежащего качества.</div>
    <div class="subsection">Исполнитель вправе требовать оплаты за оказанные услуги.</div>
    
    <div class="subsection"><strong>Права и обязанности Заказчика:</strong></div>
    <div class="subsection">Заказчик обязан осуществить оплату услуг в соответствии с настоящим Договором.</div>
    <div class="subsection">Заказчик вправе получать от Исполнителя объяснения, связанные с оказанием услуг.</div>
  </div>

  <div class="section">
    <div class="section-title">Срок оказания услуг</div>
    <div class="subsection">
      Срок оказания услуг {{event_date}}.
    </div>
    <div class="subsection">
      По окончании оказания услуги сторонами составляется акт приемки оказанных услуг, 
      в котором должно быть указано наименование оказанной услуги и ее стоимость.
    </div>
  </div>

  <div class="section">
    <div class="section-title">Ответственность сторон</div>
    <div class="subsection">
      Стороны несут ответственность за нарушение условий настоящего Договора в соответствии с законодательством Российской Федерации.
    </div>
    <div class="subsection">
      Сторона, не исполнившая или ненадлежащим образом исполнившая свои обязательства по настоящему Договору, 
      обязана возместить другой стороне причиненные этим убытки.
    </div>
    <div class="subsection">
      В случае повреждения предоставляемого Исполнителем звукового оборудования сотрудниками Заказчика 
      и (или) зрителями мероприятия, Исполнитель вправе потребовать возмещения ущерба.
    </div>
  </div>

  <div class="section">
    <div class="section-title">Порядок разрешения споров</div>
    <div class="subsection">
      Все споры или разногласия, возникающие между сторонами по настоящему Договору или в связи с ним, 
      разрешаются путем переговоров между сторонами.
    </div>
    <div class="subsection">
      В случае невозможности разрешения споров или разногласий путем переговоров они подлежат разрешению 
      судом в установленном законодательством порядке.
    </div>
  </div>

  <div class="section">
    <div class="section-title">Срок действия договора</div>
    <div class="subsection">
      Настоящий договор вступает в силу с момента его подписания обеими Сторонами и действует до полного 
      исполнения сторонами обязательств по настоящему договору.
    </div>
  </div>

  <div class="section">
    <div class="section-title">Порядок изменения и дополнения договора</div>
    <div class="subsection">
      Любые изменения и дополнения к настоящему Договору имеют силу только в том случае, 
      если они оформлены в письменном виде и подписаны обеими сторонами.
    </div>
  </div>

  <div class="section">
    <div class="section-title">Прочие условия</div>
    <div class="subsection">
      Настоящий Договор составлен в двух экземплярах, имеющих одинаковую силу, по одному экземпляру для каждой из сторон.
    </div>
  </div>

  <div class="section">
    <div class="section-title">Адреса, банковские реквизиты и подписи сторон</div>
    
    <table class="requisites-table">
      <tr>
        <td>
          <strong>Исполнитель:</strong><br><br>
          {{executor_type}} {{executor_name}}<br>
          ИНН: {{executor_inn}}<br>
          ОГРНИП: {{executor_ogrn}}<br>
          Адрес: {{executor_address}}<br><br>
          Расчётный счет: {{executor_bank_account}}<br>
          Название банка: {{executor_bank_name}}<br>
          БИК: {{executor_bank_bik}}<br>
          Корр.счёт: {{executor_bank_corr_account}}<br><br>
          <div class="signature-line">
            ______________ {{executor_representative_short}}<br>
            М.П.
          </div>
        </td>
        <td>
          <strong>Заказчик:</strong><br><br>
          {{customer_type}} {{customer_name}}<br>
          ИНН: {{customer_inn}}<br>
          ОГРНИП: {{customer_ogrn}}<br>
          Адрес: {{customer_address}}<br><br>
          Расчётный счет: {{customer_bank_account}}<br>
          Название банка: {{customer_bank_name}}<br>
          БИК: {{customer_bank_bik}}<br>
          Корр.счёт: {{customer_bank_corr_account}}<br><br>
          <div class="signature-line">
            ______________ {{customer_representative_short}}<br>
            М.П.
          </div>
        </td>
      </tr>
    </table>
  </div>

  <div class="page-break"></div>

  <div class="spec-title">
    Приложение № 1<br>
    к Договору о возмездном оказании услуг от {{contract_date}} № {{contract_number}}<br><br>
    <strong>СПЕЦИФИКАЦИЯ</strong><br>
    на оказание услуг по предоставлению оборудования и персонала
  </div>

  {{specification_table}}

  <div style="margin-top: 30px; text-align: right; font-weight: bold;">
    ИТОГО: {{total_amount}}
  </div>

  <div style="margin-top: 50px;">
    <table style="width: 100%;">
      <tr>
        <td style="width: 50%; vertical-align: top;">
          {{executor_type}}<br>
          {{executor_name}}<br>
          ___________________ {{executor_representative_short}}
        </td>
        <td style="width: 50%; vertical-align: top;">
          {{customer_type}}<br>
          {{customer_name}}<br>
          ___________________ {{customer_representative_short}}
        </td>
      </tr>
    </table>
  </div>
</body>
</html>',
  'Шаблон на основе договора 4-26У от 3 марта 2026. Включает полные условия, права и обязанности сторон, порядок разрешения споров.',
  FALSE,
  NULL
ON CONFLICT DO NOTHING;

-- ============================================
-- Проверка
-- ============================================
SELECT 'Шаблон на основе файла 4-26У создан!' as status;

// Стандартные размеры диалоговых окон для единообразия UI

export const DIALOG_SIZES = {
  // Маленькие диалоги (подтверждения, уведомления)
  sm: 'max-w-sm',      // 384px
  
  // Средние диалоги (формы, редактирование)
  md: 'max-w-md',      // 448px
  
  // Большие диалоги (создание/редактирование смет, оборудования)
  lg: 'max-w-lg',      // 512px
  
  // Очень большие диалоги (сложные формы, импорт)
  xl: 'max-w-xl',      // 576px
  
  // 2XL - для таблиц, списков
  '2xl': 'max-w-2xl',  // 672px
  
  // 3XL - для сложных интерфейсов (чек-листы)
  '3xl': 'max-w-3xl',  // 768px
  
  // 4XL - для полноэкранных диалогов
  '4xl': 'max-w-4xl',  // 896px
} as const;

// Стандартные классы для DialogContent
export const getDialogClasses = (size: keyof typeof DIALOG_SIZES = 'md', options?: {
  fullHeight?: boolean;
  noPadding?: boolean;
  mobileFull?: boolean;
}) => {
  const baseClasses = [
    DIALOG_SIZES[size],
    'w-[95%]',
    'rounded-xl',
    'overflow-hidden',
    'flex flex-col',
  ];
  
  if (options?.fullHeight) {
    baseClasses.push('max-h-[90vh]');
  } else {
    baseClasses.push('max-h-[85vh]');
  }
  
  if (options?.noPadding) {
    baseClasses.push('p-0');
  } else {
    baseClasses.push('p-4 sm:p-6');
  }
  
  if (options?.mobileFull) {
    baseClasses.push('sm:w-auto');
  }
  
  return baseClasses.join(' ');
};

// Рекомендуемые размеры для типичных сценариев
export const DIALOG_PRESETS = {
  // Подтверждение удаления
  confirmDelete: getDialogClasses('sm'),
  
  // Форма создания/редактирования (смета, оборудование)
  form: getDialogClasses('lg', { fullHeight: true }),
  
  // Просмотр деталей
  details: getDialogClasses('2xl', { fullHeight: true }),
  
  // Импорт данных
  import: getDialogClasses('3xl', { fullHeight: true }),
  
  // Превью документов
  preview: getDialogClasses('4xl', { fullHeight: true, noPadding: true }),
} as const;

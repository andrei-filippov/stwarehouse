import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import mammoth from 'mammoth';
import type { ContractTemplate } from '../types';

export function useContractTemplates(userId: string | undefined, companyId: string | undefined) {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!userId || !companyId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    
    if (error) {
      toast.error('Ошибка при загрузке шаблонов договоров', { description: error.message });
    } else if (data) {
      setTemplates(data as ContractTemplate[]);
    }
    setLoading(false);
  }, [userId, companyId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Загрузка файла шаблона
  const uploadTemplateFile = async (
    file: File, 
    templateData: Omit<ContractTemplate, 'id' | 'created_at' | 'updated_at'>
  ) => {
    if (!userId) return { error: new Error('User not authenticated') };
    if (!companyId) return { error: new Error('No company selected') };

    // Проверяем тип файла
    const allowedTypes = [
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-word.document.macroEnabled.12', // .docm
    ];
    const allowedExts = ['doc', 'docx', 'docm'];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(fileExt)) {
      toast.error('Неподдерживаемый формат файла', { 
        description: 'Поддерживаются только файлы .doc, .docx' 
      });
      return { error: new Error('Invalid file type') };
    }

    // Проверяем размер (макс 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Файл слишком большой', { description: 'Максимальный размер 10MB' });
      return { error: new Error('File too large') };
    }

    try {
      // 1. Загружаем файл в Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('contract-templates')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // 2. Конвертируем DOCX в HTML для предпросмотра
      let htmlContent = '';
      if (fileExt === 'docx' || fileExt === 'docm') {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer }, {
            styleMap: [
              "p[style-name='Heading 1'] => h1",
              "p[style-name='Heading 2'] => h2",
              "p[style-name='Heading 3'] => h3",
            ]
          });
          htmlContent = `<div style="font-family:'Times New Roman', serif; font-size:12pt; line-height:1.5;">${result.value}</div>`;
        } catch (convErr: any) {
          console.error('Mammoth conversion error:', convErr);
        }
      }

      // 3. Создаем запись в БД
      const { data: template, error: dbError } = await supabase
        .from('contract_templates')
        .insert([{
          user_id: userId,
          company_id: companyId,
          name: templateData.name,
          type: templateData.type,
          description: templateData.description,
          is_default: templateData.is_default,
          is_file_template: true,
          file_path: filePath,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          content: htmlContent, // HTML для предпросмотра
        }])
        .select()
        .single();

      if (dbError) {
        // Удаляем файл из Storage при ошибке
        await supabase.storage.from('contract-templates').remove([filePath]);
        throw dbError;
      }

      await fetchTemplates();
      toast.success('Шаблон договора загружен', { description: templateData.name });
      return { error: null, data: template };
    } catch (error: any) {
      toast.error('Ошибка при загрузке шаблона', { description: error.message });
      return { error };
    }
  };

  // Создание текстового шаблона (без файла)
  const createTextTemplate = async (template: Omit<ContractTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    if (!userId) return { error: new Error('User not authenticated') };
    if (!companyId) return { error: new Error('No company selected') };
    
    const { data, error } = await supabase
      .from('contract_templates')
      .insert([{ ...template, user_id: userId, is_file_template: false }])
      .select()
      .single();
    
    if (error) {
      toast.error('Ошибка при создании шаблона', { description: error.message });
      return { error };
    }

    await fetchTemplates();
    toast.success('Шаблон создан', { description: template.name });
    return { error: null, data };
  };

  // Обновление шаблона
  const updateTemplate = async (id: string, updates: Partial<ContractTemplate>) => {
    const { error } = await supabase
      .from('contract_templates')
      .update(updates)
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка при обновлении шаблона', { description: error.message });
      return { error };
    }

    await fetchTemplates();
    toast.success('Шаблон обновлен');
    return { error: null };
  };

  // Удаление шаблона
  const deleteTemplate = async (id: string, filePath?: string) => {
    // Если есть файл - удаляем из Storage
    if (filePath) {
      const { error: storageError } = await supabase.storage
        .from('contract-templates')
        .remove([filePath]);
      
      if (storageError) {
        console.error('Error deleting file:', storageError);
      }
    }

    const { error } = await supabase
      .from('contract_templates')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка при удалении шаблона', { description: error.message });
      return { error };
    }

    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success('Шаблон удален');
    return { error: null };
  };

  // Получение URL для скачивания файла
  const getFileUrl = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from('contract-templates')
      .createSignedUrl(filePath, 60 * 60); // Ссылка на 1 час

    if (error) {
      toast.error('Ошибка при получении файла', { description: error.message });
      return { error, url: null };
    }

    return { error: null, url: data.signedUrl };
  };

  // Скачивание файла
  const downloadFile = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('contract-templates')
      .download(filePath);

    if (error) {
      toast.error('Ошибка при скачивании файла', { description: error.message });
      return { error };
    }

    // Создаем ссылку для скачивания
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { error: null };
  };

  return {
    templates,
    loading,
    uploadTemplateFile,
    createTextTemplate,
    updateTemplate,
    deleteTemplate,
    getFileUrl,
    downloadFile,
    refresh: fetchTemplates,
  };
}

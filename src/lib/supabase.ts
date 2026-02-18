import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://trivdyjfiyxsmrkihqet.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_l4TMwhafnf4JGPBqDu9UBQ_Rsk9_BKU';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);


export const getEstimates = async () => {
const { data, error } = await supabase
.from('estimates')
.select('*')
.order('created_at', { ascending: false });
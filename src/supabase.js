import { createClient } from '@supabase/supabase-js'

// Ganti teks di dalam tanda kutip dengan URL dan Key milik Anda!
const supabaseUrl = 'https://bluthfimzblfnutxhxvv.supabase.co'
const supabaseKey = 'sb_publishable_1XiLFzf4QRi6PqrvSshzbQ_Eo0Riwsi'

export const supabase = createClient(supabaseUrl, supabaseKey)
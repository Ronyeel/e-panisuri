import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bnbhhbyuyiieavrjzwkk.supabase.co'
const supabaseKey = 'sb_publishable_HuPW6OR0Ide-yZJoMcvgoA_RnE2A7Id'

export const supabase = createClient(supabaseUrl, supabaseKey)
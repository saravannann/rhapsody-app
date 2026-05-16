
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debug() {
  const { data: events } = await supabase.from('events').select('*')
  console.log('Events:', events)

  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, purchaser_name, event_id, created_at')
    .ilike('purchaser_name', '%Saravanan%')
  
  console.log('Tickets for Saravanan:', tickets)
}

debug()

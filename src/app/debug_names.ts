
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debug() {
  const { data: t1 } = await supabase.from('tickets').select('*').eq('sequence_number', 686).maybeSingle()
  const { data: t2 } = await supabase.from('tickets').select('*').eq('sequence_number', 678).maybeSingle()
  
  console.log('Ticket 686:', t1?.purchaser_name, 'Event ID:', t1?.event_id)
  console.log('Ticket 678:', t2?.purchaser_name, 'Event ID:', t2?.event_id)

  const { data: events } = await supabase.from('events').select('id, name')
  console.log('Events:', events)
}

debug()

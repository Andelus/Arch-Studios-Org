import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'ok' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, data } = req.body;
    console.log('Webhook received:', { type, data });

    if (type === 'user.created') {
      const { id, email_addresses } = data;
      const email = email_addresses[0]?.email_address;

      console.log('Creating profile for:', { id, email });

      const { error } = await supabase
        .from('profiles')
        .insert({
          id: id,
          email: email,
          credits_balance: 0,
          auto_buy_enabled: false,
          free_image_used: false,
          free_model_used: false,
          subscription_status: 'CANCELLED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ message: 'Profile created successfully' });
    }

    return res.status(200).json({ message: 'Event received but not processed' });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(400).json({ error: error.message });
  }
} 
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getAuth } from '@clerk/nextjs/server';

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false
    }
  }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Using service role to bypass RLS (since we're verifying the user through Clerk)
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        credits_balance,
        subscription_status,
        current_plan_id,
        subscription_plans (
          name,
          total_credits
        )
      `)
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Profile fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
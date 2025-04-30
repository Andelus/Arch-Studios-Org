import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingProfile) {
      return NextResponse.json({ error: 'Profile already exists' }, { status: 400 });
    }

    // Create profile with trial credits
    const { error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        credits_balance: 250,
        auto_buy_enabled: false,
        subscription_status: 'TRIAL',
        current_plan_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Profile creation error:', error);
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
    }

    // Record the initial credit transaction
    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: 250,
        type: 'INITIAL_TRIAL_CREDIT',
        description: 'Initial trial credits',
        created_at: new Date().toISOString()
      });

    if (transactionError) {
      console.error('Transaction creation error:', transactionError);
    }

    return NextResponse.json({ message: 'Profile created successfully' });
  } catch (error) {
    console.error('Profile creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }
      console.error('Profile fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
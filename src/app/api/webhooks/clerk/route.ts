import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  console.log('Webhook received');
  
  try {
    // TEMPORARY: Hard-coded values for testing only
    // REMOVE THIS IN PRODUCTION!
    const supabaseUrl = 'https://qexhjdhtypjmfdrmmsql.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFleGhqZGh0eXBqbWZkcm1tc3FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg4MDkzNCwiZXhwIjoyMDYxNDU2OTM0fQ._lK5FBrwDQvRciTG45W8TRdoYuB9wqoFjItL1FjaC5c';
    
    console.log('Using hard-coded credentials for testing');
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    
    // Rest of your code...
    // ...

    return NextResponse.json({ message: 'Test successful' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
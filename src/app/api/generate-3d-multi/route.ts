import { NextResponse } from 'next/server';
import { fal } from "@fal-ai/client";
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

fal.config({
  credentials: process.env.FAL_KEY as string
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false }
  }
);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check user's credits/subscription
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits_balance, subscription_status')
      .eq('id', userId)
      .single();

    if (!profile || profile.credits_balance < 100) {
      return NextResponse.json(
        { error: 'Insufficient credits. 3D model generation requires 100 credits. Please purchase more credits to continue.' },
        { status: 403 }
      );
    }

    if (profile.subscription_status !== 'ACTIVE' && profile.subscription_status !== 'TRIAL') {
      return NextResponse.json(
        { error: 'Your subscription has expired. Please renew to continue.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { images } = body;

    if (!Array.isArray(images) || images.length < 2 || images.length > 3) {
      return NextResponse.json(
        { error: 'Between 2 and 3 images are required' },
        { status: 400 }
      );
    }

    // Convert base64 images to URLs if needed
    const imageUrls = [];
    for (const image of images) {
      if (image.startsWith('data:image')) {
        // Extract base64 content
        const base64Data = image.split(',')[1];
        
        // Upload to temporary storage or use directly
        // For this example, we'll assume we have a way to convert to URLs
        // This would be replaced with actual implementation
        
        // For demo purposes, we'll pass the base64 directly
        imageUrls.push(base64Data);
      } else {
        imageUrls.push(image);
      }
    }

    const result = await fal.subscribe("fal-ai/trellis/multi", {
      input: {
        image_urls: imageUrls,
        ss_guidance_strength: 7.5,
        ss_sampling_steps: 12,
        slat_guidance_strength: 3,
        slat_sampling_steps: 12,
        mesh_simplify: 0.95,
        texture_size: 1024,
        multiimage_algo: "stochastic"
      }
    });

    // Deduct credits and record transaction
    const { error: dbError } = await supabase.rpc('handle_generation_deduction', {
      p_user_id: userId,
      p_generation_type: 'MULTI_VIEW_3D',
      p_credit_amount: 100,
      p_description: `Generated 3D model from ${images.length} views`
    });

    if (dbError) {
      console.error('Database error during credit deduction:', dbError);
      throw new Error(`Failed to process credit deduction: ${dbError.message}`);
    }

    return NextResponse.json({
      modelUrl: result.data.model_mesh.url,
      creditsRemaining: profile.credits_balance - 100
    });
  } catch (error) {
    console.error('Error generating 3D model:', error);
    return NextResponse.json(
      { error: 'Failed to generate 3D model' },
      { status: 500 }
    );
  }
}

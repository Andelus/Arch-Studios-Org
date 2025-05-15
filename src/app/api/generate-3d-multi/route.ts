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
      .select('credits, subscription_status')
      .eq('id', userId)
      .single();

    if (!profile || profile.credits < 100) {
      return NextResponse.json(
        { error: 'Insufficient credits. 3D model generation requires 100 credits. Please purchase more credits to continue.' },
        { status: 403 }
      );
    }

    if (profile.subscription_status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Your subscription has expired. Please renew to continue.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { imageUrls } = body;

    if (!Array.isArray(imageUrls) || imageUrls.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 images are required' },
        { status: 400 }
      );
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

    // Deduct credits
    await supabase
      .from('profiles')
      .update({ credits: profile.credits - 100 })
      .eq('id', userId);

    return NextResponse.json({
      modelUrl: result.data.model_mesh.url,
      creditsRemaining: profile.credits - 100
    });
  } catch (error) {
    console.error('Error generating 3D model:', error);
    return NextResponse.json(
      { error: 'Failed to generate 3D model' },
      { status: 500 }
    );
  }
}

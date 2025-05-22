import { NextResponse } from 'next/server';
import { fal } from "@fal-ai/client";
import { auth } from '@clerk/nextjs';
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
    
    console.log(`User ${userId} has ${profile?.credits_balance || 0} credits`);

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found.' },
        { status: 404 }
      );
    }
    
    // Use credits_balance instead of credits to match database schema
    if (profile.credits_balance < 100) { 
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
    const { imageUrls } = body;

    if (!Array.isArray(imageUrls) || imageUrls.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 images are required' },
        { status: 400 }
      );
    }

    // Add validation for image URLs and count
    if (imageUrls.length > 23) {
      return NextResponse.json(
        { error: 'Maximum of 23 images allowed' },
        { status: 400 }
      );
    }
    
    // Check if all URLs are valid
    for (const url of imageUrls) {
      try {
        if (!url || (typeof url === 'string' && url.trim() === '')) {
          return NextResponse.json(
            { error: 'Empty image URL detected' },
            { status: 400 }
          );
        }
        
        // For data URLs, check if they're properly formatted
        if (url.startsWith('data:image/')) {
          // Data URLs are valid for our use
          continue;
        }
        
        // For regular URLs, validate them
        new URL(url);
      } catch (e) {
        return NextResponse.json(
          { error: 'One or more image URLs are invalid' },
          { status: 400 }
        );
      }
    }

    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2-minute timeout

    try {
      // Log the length of each URL to help debug (without exposing actual content)
      console.log(`Processing ${imageUrls.length} images with lengths:`, 
        imageUrls.map(url => url ? url.length : 0));

      // Process data URLs if needed - FAL API might have issues with direct data URLs
      const processedUrls = imageUrls.map(url => {
        if (url && url.startsWith('data:image/')) {
          // For now, we'll use the URLs as-is, but log that we're sending data URLs
          console.log('Sending data URL to FAL API');
          return url;
        }
        return url;
      });

      // Make sure we have valid URLs
      if (processedUrls.some(url => !url)) {
        console.error('Null or undefined URL detected after processing');
        return NextResponse.json(
          { error: 'One or more images could not be processed properly' },
          { status: 400 }
        );
      }

      const result = await fal.subscribe("fal-ai/trellis/multi", {
        input: {
          image_urls: processedUrls,
          ss_guidance_strength: 7.5,
          ss_sampling_steps: 12,
          slat_guidance_strength: 3,
          slat_sampling_steps: 12,
          mesh_simplify: 0.95,
          texture_size: 1024,
          multiimage_algo: "multidiffusion" // Fixed: changed from "multi_diffusion" to "multidiffusion" as per documentation
        },
        logs: true, // Enable logs for better debugging
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            console.log(`Processing update: ${update.logs[update.logs.length - 1]?.message || 'Processing...'}`);
          }
        }
      });

      // Clear the timeout since the request completed
      clearTimeout(timeoutId);

      // Verify we have a valid model URL before deducting credits
      if (!result?.data?.model_mesh?.url) {
        return NextResponse.json(
          { error: 'The 3D model generation service returned an incomplete response' },
          { status: 500 }
        );
      }

      // Deduct credits only after successful generation
      await supabase
        .from('profiles')
        .update({ credits_balance: profile.credits_balance - 100 })
        .eq('id', userId);

      return NextResponse.json({
        modelUrl: result.data.model_mesh.url,
        creditsRemaining: profile.credits_balance - 100
      });
    } catch (error) {
      // Clear the timeout to prevent memory leaks
      clearTimeout(timeoutId);
      throw error; // Re-throw to be caught by the outer catch block
    }
  } catch (error) {
    console.error('Error generating 3D model:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'The request timed out. Please try again.' },
          { status: 408 }
        );
      }
      
      if (error.message.includes('Unauthorized') || error.message.includes('auth')) {
        return NextResponse.json(
          { error: 'Authentication failed. Please sign in again.' },
          { status: 401 }
        );
      }
      
      if (error.message.includes('not found') || error.message.toLowerCase().includes('404')) {
        return NextResponse.json(
          { error: 'The 3D generation service is currently unavailable.' },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to generate 3D model' },
      { status: 500 }
    );
  }
}

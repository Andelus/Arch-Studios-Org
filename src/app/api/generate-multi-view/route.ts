import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MultiViewRequest {
  prompt: string;
  views: string[];
  referenceImage: string | null;
  quality: 'none' | 'minor' | 'major';
  generate3D: boolean;
}

interface DatabaseProfile {
  credits_balance: number;
  current_plan_id: string | null;
  subscription_status: string;
  subscription_plan: {
    image_credit_cost: number;
    name: string;
  } | null;
}

// Quality settings mapping for gpt-image-1
const qualitySettings = {
  none: { quality: 'low' }, // 272 tokens for 1024x1024
  minor: { quality: 'medium' }, // 1056 tokens for 1024x1024
  major: { quality: 'high' }, // 4160 tokens for 1024x1024
} as const;

// Helper function to validate quality access
function canAccessQuality(profile: DatabaseProfile, quality: 'none' | 'minor' | 'major'): boolean {
  switch (quality) {
    case 'none': // Standard quality
      return true;
    case 'minor': // Enhanced quality
      return profile.subscription_status === 'ACTIVE';
    case 'major': // Premium quality
      return profile.subscription_status === 'ACTIVE' && 
             (profile.subscription_plan?.name?.toLowerCase() || '').includes('pro');
    default:
      return false;
  }
}

function getQualityErrorMessage(quality: 'none' | 'minor' | 'major'): string {
  switch (quality) {
    case 'minor':
      return 'Enhanced quality requires an active subscription. Please upgrade to Standard or Pro plan.';
    case 'major':
      return 'Premium quality requires an active Pro subscription. Please upgrade to the Pro plan.';
    default:
      return 'Invalid quality level selected.';
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized',
        status: 401 
      });
    }

    // Parse request body
    const body = await request.json() as MultiViewRequest;
    const { prompt, views, referenceImage, quality, generate3D } = body;

    if (!prompt) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid input',
        message: 'Prompt is required',
        status: 400 
      });
    }

    if (!views || !Array.isArray(views) || views.length === 0 || views.length > 3) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid input',
        message: 'Between 1 and 3 views must be selected',
        status: 400 
      });
    }

    // Get user's profile and subscription plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        credits_balance,
        current_plan_id,
        subscription_status,
        subscription_plan:subscription_plans (
          image_credit_cost,
          name
        )
      `)
      .eq('id', userId)
      .single() as { data: DatabaseProfile | null, error: any };

    if (profileError) {
      console.error('Profile error:', profileError);
      return NextResponse.json({ 
        success: false,
        error: profileError.code === 'PGRST116' ? 'Profile not found' : 'Failed to fetch user profile',
        details: profileError.message,
        status: profileError.code === 'PGRST116' ? 404 : 500
      });
    }

    if (!profile) {
      return NextResponse.json({ 
        success: false,
        error: 'Profile not found',
        status: 404
      });
    }

    // Check subscription status
    if (profile.subscription_status !== 'TRIAL' && profile.subscription_status !== 'ACTIVE') {
      return NextResponse.json({ 
        success: false,
        error: 'Subscription expired',
        message: 'Your subscription has expired or been cancelled. Please renew your subscription to continue.',
        status: 403
      });
    }

    // Validate quality level access
    if (!canAccessQuality(profile, quality)) {
      return NextResponse.json({
        success: false,
        error: 'Quality level not available',
        message: getQualityErrorMessage(quality),
        status: 403
      });
    }

    // Calculate credit cost (100 credits per image)
    const creditCost = views.length * 100;

    if (profile.credits_balance < creditCost) {
      return NextResponse.json({ 
        success: false,
        error: 'Insufficient credits',
        message: `This operation requires ${creditCost} credits. You have ${profile.credits_balance} credits. Please purchase more credits or upgrade your plan.`,
        status: 403
      });
    }

    // Generate images for each selected view
    const generatedImages: { view: string, image: string }[] = [];

    try {
      for (const view of views) {
        // Create an enhanced prompt for each view
        let enhancedPrompt = `Create a detailed architectural visualization of ${prompt} from the ${view} view.`;
        
        // Add quality-specific enhancements
        if (quality === 'major') {
          enhancedPrompt += ' Create a highly detailed, professional architectural visualization with perfect lighting, shadows, reflections, and rich textures. Pay special attention to architectural accuracy and photorealism.';
        } else if (quality === 'minor') {
          enhancedPrompt += ' Create a professional architectural visualization with good attention to detail, lighting, and composition.';
        }

        // Generate the image
        const apiResponse = await openai.images.generate({
          model: "gpt-image-1",
          prompt: enhancedPrompt,
          n: 1,
          quality: qualitySettings[quality].quality,
          size: "1024x1024"
        });

        const generatedImageBase64 = apiResponse.data?.[0]?.b64_json;
        if (!generatedImageBase64) {
          throw new Error(`No image data returned from OpenAI for ${view} view`);
        }

        generatedImages.push({ 
          view, 
          image: generatedImageBase64 
        });
      }

      // Deduct credits and record transaction atomically
      const { error: dbError } = await supabase.rpc('handle_generation_deduction', {
        p_user_id: userId,
        p_generation_type: 'MULTI_VIEW',
        p_credit_amount: creditCost,
        p_description: `Generated ${views.length} multi-view images: ${prompt.substring(0, 100)}`
      });

      if (dbError) {
        console.error('Database error during credit deduction:', dbError);
        throw new Error(`Failed to process credit deduction: ${dbError.message}`);
      }
      
      // Save each generated image to user's asset history
      for (const generatedImage of generatedImages) {
        const imageData = `data:image/png;base64,${generatedImage.image}`;
        await supabase
          .from('user_assets')
          .insert({
            user_id: userId,
            asset_type: 'multi_view',
            asset_url: imageData,
            prompt: `${prompt} (${generatedImage.view} view)`,
            metadata: {
              view: generatedImage.view,
              quality,
              generate3D
            }
          });
      }

      // Return success with images and remaining credits
      return NextResponse.json({
        success: true,
        images: generatedImages,
        creditsRemaining: profile.credits_balance - creditCost,
        generate3D
      });
    
    } catch (error: any) {
      console.error('Error during OpenAI API call:', error);
      if (error?.response?.data?.error) {
        return NextResponse.json(
          { error: error.response.data.error.message },
          { status: error.response.status || 500 }
        );
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error during multi-view image generation:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'An unexpected error occurred while processing your request'
      },
      { status: 500 }
    );
  }
}

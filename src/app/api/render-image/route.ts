import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RenderRequest {
  image?: string;          // Base64-encoded reference image (optional)
  prompt: string;          // User's description
  category: string;        // interior, exterior, masterplan, virtual staging, landscape, sketch
  outputType: string;      // 3D, photo, drawing, wireframe, construction
  style: string;          // realistic, cgi, night, snow, rain, sketch, illustration
  drawAssist: string;     // none, minor, major - for quality control
}

interface UserProfile {
  credits_balance: number;
  subscription_status: string;
  id: string;
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json() as RenderRequest;
    const { image, prompt, category, outputType, style, drawAssist } = body;

    if (!prompt || !category || !outputType || !style) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check user's credits and subscription
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_balance, subscription_status')
      .eq('id', userId)
      .single() as { data: UserProfile | null; error: any };

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    // Check subscription status
    if (profile.subscription_status !== 'TRIAL' && profile.subscription_status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Your subscription has expired. Please renew to continue.' },
        { status: 403 }
      );
    }

    if (profile.credits_balance < 1) {
      return NextResponse.json(
        { error: 'Insufficient credits' },
        { status: 402 }
      );
    }

    try {
      // Enhance the prompt based on category and style
      const categoryPrompts = {
        interior: "Create an interior architectural visualization",
        exterior: "Generate an exterior architectural visualization",
        masterplan: "Design a comprehensive architectural masterplan",
        "virtual staging": "Create a virtually staged interior space",
        landscape: "Design an architectural landscape visualization",
        sketch: "Create an architectural sketch"
      };

      const styleModifiers = {
        realistic: "photorealistic, highly detailed, professional architectural photography style",
        cgi: "3D CGI rendering, clean and modern visualization",
        night: "nighttime scene with dramatic lighting and ambiance",
        snow: "winter scene with snow coverage and appropriate lighting",
        rain: "rainy atmosphere with wet surfaces and reflections",
        sketch: "architectural sketch style with hand-drawn qualities",
        illustration: "stylized architectural illustration"
      };

      const outputModifiers = {
        "3D": "Create a detailed 3D visualization",
        photo: "Generate a photorealistic image",
        drawing: "Create a detailed architectural drawing",
        wireframe: "Generate a professional wireframe visualization",
        construction: "Create a detailed construction documentation view"
      };

      // Add quality-specific enhancements to the prompt
      const qualityModifiers = {
        none: "with standard quality and balanced details",
        minor: "with enhanced quality, good lighting, and careful attention to architectural details",
        major: "with premium quality, perfect lighting, ultra-high detail, professional post-processing, masterful composition, and photographic excellence"
      };

      const enhancedPrompt = `${categoryPrompts[category as keyof typeof categoryPrompts] || ''} 
of: ${prompt}. Output as ${outputModifiers[outputType as keyof typeof outputModifiers]} 
${qualityModifiers[drawAssist as keyof typeof qualityModifiers]}. 
Style: ${styleModifiers[style as keyof typeof styleModifiers]}`;

      console.log('Making OpenAI API call with params:', {
        model: "gpt-image-1",
        prompt: enhancedPrompt,
        quality: drawAssist === 'major' ? 'high' : 'medium'
      });

      const apiParams: any = {
        model: "gpt-image-1",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        quality: drawAssist === 'major' ? 'high' : 'medium',
        response_format: "b64_json"
      };

      // If reference image is provided, use it
      if (image) {
        const imageStr = image.split('base64,').pop() || image;
        const imageBuffer = Buffer.from(imageStr, 'base64');
        apiParams.image = new File([new Uint8Array(imageBuffer)], "reference.png", { type: "image/png" });
      }

      const response = await openai.images.generate(apiParams);

      const generatedImageBase64 = response.data?.[0]?.b64_json;
      if (!generatedImageBase64) {
        return NextResponse.json({ error: 'No image data returned from OpenAI' }, { status: 500 });
      }

      // Deduct 1 credit from the user
      const { error: creditError } = await supabase
        .from('profiles')
        .update({ credits_balance: profile.credits_balance - 1 })
        .eq('id', userId);

      if (creditError) {
        console.error('Error deducting credits:', creditError);
        return NextResponse.json(
          { error: 'Failed to deduct credits' },
          { status: 500 }
        );
      }

      // Return the processed image
      return NextResponse.json({ 
        image: generatedImageBase64,
        creditsRemaining: profile.credits_balance - 1
      });

    } catch (error: any) {
      console.error('Error during OpenAI API call:', {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        type: error?.type,
        stack: error?.stack,
        response: {
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          data: error?.response?.data
        }
      });

      if (error?.response?.data?.error) {
        return NextResponse.json(
          { error: error.response.data.error.message },
          { status: error.response.status || 500 }
        );
      }

      throw error;
    }
  } catch (error: any) {
    console.error('Error during image rendering:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'An unexpected error occurred while processing your request'
      },
      { status: 500 }
    );
  }
}

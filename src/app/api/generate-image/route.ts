import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generatePrompt = (style: string, material: string) => {
  return `A stunning architectural visualization of a ${style.toLowerCase()} building crafted from ${material.toLowerCase()}. The design showcases clean lines, dramatic lighting, and a minimalist aesthetic. The building is presented in a professional architectural style with perfect composition, high-end rendering quality, and a focus on architectural details. The image should be suitable for a luxury architectural portfolio. The image should be suitable for a 3D rendering.`;
};

export async function POST(req: Request) {
  try {
    const { prompt, style, material, size = '1024x1024', n = 4 } = await req.json();

    // Only require a prompt
    if (!prompt) {
      return NextResponse.json(
        { error: 'A prompt is required' },
        { status: 400 }
      );
    }

    // If style and material are provided, use them to generate the prompt
    const finalPrompt = style && material ? generatePrompt(style, material) : prompt;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: size as "1024x1024" | "1024x1792" | "1792x1024",
      quality: "standard",
      style: "natural",
    });

    if (!response.data?.[0]?.url) {
      throw new Error('No image URL in response');
    }

    return NextResponse.json({ images: [response.data[0].url] });
  } catch (error: any) {
    console.error('Error generating image:', error);
    
    // Check for specific error types
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Error response:', error.response.data);
      return NextResponse.json(
        { 
          error: 'OpenAI API Error',
          details: error.response.data.error?.message || 'Unknown API error',
          type: 'API_ERROR'
        },
        { status: error.response.status }
      );
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
      return NextResponse.json(
        { 
          error: 'No response from OpenAI',
          details: 'The request was made but no response was received',
          type: 'NETWORK_ERROR'
        },
        { status: 503 }
      );
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
      return NextResponse.json(
        { 
          error: 'Request setup error',
          details: error.message,
          type: 'REQUEST_ERROR'
        },
        { status: 500 }
      );
    }
  }
} 
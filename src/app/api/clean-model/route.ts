import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { NodeIO } from '@gltf-transform/core';
import draco3d from 'draco3dgltf';
import { 
  dedup,
  prune,
  weld,
  resample,
  simplify
} from '@gltf-transform/functions';
import { meshopt } from '@gltf-transform/functions';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { modelUrl } = await req.json();
    if (!modelUrl) {
      return NextResponse.json({ error: 'Model URL is required' }, { status: 400 });
    }

    try {
      // Download the model
      const response = await fetch(modelUrl);
      if (!response.ok) {
        throw new Error('Failed to download model');
      }
      
      const modelData = await response.arrayBuffer();
      
      // Initialize GLTF transformer with Draco support
      const io = new NodeIO().registerExtensions([draco3d]);
      const document = await io.readBinary(new Uint8Array(modelData));

      // Apply optimizations
      await document.transform(
        // Remove unused resources
        prune(),
        
        // Remove duplicate vertices and similar materials
        dedup(),
        
        // Weld vertices that share position/normal/etc.
        weld(),
        
        // Resample animations if present
        resample(),

        // Simplify mesh geometry
        simplify({
          simplifier: meshopt,
          ratio: 0.5,        // Reduce to 50% of original vertex count
          error: 0.01,       // Maximum deviation from original mesh
          lockBorder: true,  // Preserve mesh boundaries
          ratio: 0.5        // Target ratio of vertices to keep
        })
      );

      // Convert back to binary
      const optimizedBuffer = await io.writeBinary(document);

      // Return the optimized model
      return new NextResponse(optimizedBuffer, {
        headers: {
          'Content-Type': 'model/gltf-binary',
          'Content-Disposition': 'attachment; filename="cleaned_model.glb"'
        }
      });
    } catch (error) {
      console.error('Error processing model:', error);
      return NextResponse.json({ 
        error: 'Failed to clean model',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Route error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

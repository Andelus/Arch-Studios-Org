import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Document, NodeIO, Root, Primitive, Accessor } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3d';

function optimizeGeometry(primitive: Primitive, document: Document): void {
  const positions = primitive.getAttribute('POSITION');
  const indices = primitive.getIndices();
  
  if (!positions || !indices) return;

  const posArray = positions.getArray();
  const idxArray = indices.getArray();
  
  if (!posArray || !idxArray) return;

  // Create a map to track unique vertices
  const uniqueVertices = new Map<string, number>();
  const newIndices: number[] = [];
  const newPositions: number[] = [];
  let nextIndex = 0;

  // Iterate through each vertex
  for (let i = 0; i < idxArray.length; i++) {
    const idx = idxArray[i];
    const x = posArray[idx * 3];
    const y = posArray[idx * 3 + 1];
    const z = posArray[idx * 3 + 2];
    
    // Use a higher precision for vertex identification
    const key = `${Math.round(x * 10000)},${Math.round(y * 10000)},${Math.round(z * 10000)}`;

    if (!uniqueVertices.has(key)) {
      uniqueVertices.set(key, nextIndex);
      newPositions.push(x, y, z);
      nextIndex++;
    }
    newIndices.push(uniqueVertices.get(key)!);
  }

  // Update positions with optimized data
  positions.setArray(new Float32Array(newPositions));
  
  // Create new indices accessor
  const newIndicesAccessor = document.createAccessor()
    .setType('SCALAR')
    .setArray(new Uint32Array(newIndices));
  
  primitive.setIndices(newIndicesAccessor);
}

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
      
      // Initialize GLTF transformer with Draco compression
      const io = new NodeIO()
        .registerExtensions([KHRDracoMeshCompression])
        .registerDependencies({
          'draco3d.decoder': await draco3d.createDecoderModule(),
          'draco3d.encoder': await draco3d.createEncoderModule(),
        });

      const document = await io.readBinary(new Uint8Array(modelData));

      // Apply optimizations
      const root = document.getRoot();
      const scene = root.getDefaultScene() || root.listScenes()[0];
      
      if (scene) {
        // Optimize each mesh in the scene
        for (const mesh of root.listMeshes()) {
          for (const primitive of mesh.listPrimitives()) {
            // Step 1: Remove unnecessary attributes
            const attributes = primitive.listAttributes();
            for (const attribute of attributes) {
              if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(attribute.getName())) {
                primitive.setAttribute(attribute.getName(), null);
              }
            }
            
            // Step 2: Optimize geometry (remove duplicate vertices)
            optimizeGeometry(primitive, document);
            
            // Step 3: Quantize vertex positions for better compression
            const pos = primitive.getAttribute('POSITION');
            if (pos) {
              const arr = pos.getArray();
              if (arr) {
                const quantized = new Float32Array(arr.length);
                for (let i = 0; i < arr.length; i++) {
                  // Quantize to millimeter precision
                  quantized[i] = Math.round(arr[i] * 1000) / 1000;
                }
                pos.setArray(quantized);
              }
            }
          }
        }
      }

      // Convert back to binary with Draco compression
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

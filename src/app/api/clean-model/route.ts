import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Document, NodeIO, Root, Primitive, Accessor } from '@gltf-transform/core';

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

// Calculate edge collapse cost (how much visual impact removing this vertex would have)
function calculateEdgeCost(v1: Vector3, v2: Vector3, v3: Vector3): number {
  // Calculate normal of the triangle
  const dx1 = v2.x - v1.x;
  const dy1 = v2.y - v1.y;
  const dz1 = v2.z - v1.z;
  const dx2 = v3.x - v1.x;
  const dy2 = v3.y - v1.y;
  const dz2 = v3.z - v1.z;
  
  // Cross product to get normal
  const nx = dy1 * dz2 - dz1 * dy2;
  const ny = dz1 * dx2 - dx1 * dz2;
  const nz = dx1 * dy2 - dy1 * dx2;
  
  // Length of normal (area of parallelogram)
  return Math.sqrt(nx * nx + ny * ny + nz * nz);
}

function optimizeGeometry(primitive: Primitive, document: Document): void {
  const positions = primitive.getAttribute('POSITION');
  const indices = primitive.getIndices();
  
  if (!positions || !indices) return;

  const posArray = positions.getArray();
  const idxArray = indices.getArray();
  
  if (!posArray || !idxArray) return;

  // Convert TypedArrays to regular arrays for processing
  const positionArray = Array.from(posArray);
  const indexArray = Array.from(idxArray);

  // Create a map to track vertex costs
  const vertexCosts = new Map<number, number>();
  
  // Calculate cost for each vertex based on connected triangles
  for (let i = 0; i < indexArray.length; i += 3) {
    const v1 = indexArray[i];
    const v2 = indexArray[i + 1];
    const v3 = indexArray[i + 2];
    
    const p1 = {
      x: positionArray[v1 * 3],
      y: positionArray[v1 * 3 + 1],
      z: positionArray[v1 * 3 + 2]
    };
    const p2 = {
      x: positionArray[v2 * 3],
      y: positionArray[v2 * 3 + 1],
      z: positionArray[v2 * 3 + 2]
    };
    const p3 = {
      x: positionArray[v3 * 3],
      y: positionArray[v3 * 3 + 1],
      z: positionArray[v3 * 3 + 2]
    };
    
    const cost = calculateEdgeCost(p1, p2, p3);
    
    // Add cost to each vertex
    [v1, v2, v3].forEach(v => {
      vertexCosts.set(v, (vertexCosts.get(v) || 0) + cost);
    });
  }

  // Sort vertices by cost
  const sortedVertices = Array.from(vertexCosts.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([vertex]) => vertex);

  // Keep track of removed vertices
  const removedVertices = new Set<number>();
  const targetCount = Math.floor(sortedVertices.length * 0.5); // Target 50% reduction
  
  // Remove low-cost vertices
  for (const vertex of sortedVertices) {
    if (removedVertices.size >= targetCount) break;
    
    // Don't remove vertices that would create degenerate triangles
    let canRemove = true;
    for (let i = 0; i < indexArray.length; i += 3) {
      const v1 = indexArray[i];
      const v2 = indexArray[i + 1];
      const v3 = indexArray[i + 2];
      
      if ([v1, v2, v3].filter(v => !removedVertices.has(v)).length <= 2) {
        canRemove = false;
        break;
      }
    }
    
    if (canRemove) {
      removedVertices.add(vertex);
    }
  }

  // Create new position and index arrays without removed vertices
  const newPositions: number[] = [];
  const newIndices: number[] = [];
  const indexMap = new Map<number, number>();
  let nextIndex = 0;

  // Build new arrays excluding removed vertices
  for (let i = 0; i < indexArray.length; i += 3) {
    const v1 = indexArray[i];
    const v2 = indexArray[i + 1];
    const v3 = indexArray[i + 2];
    
    // Skip triangles with removed vertices
    if (removedVertices.has(v1) || removedVertices.has(v2) || removedVertices.has(v3)) {
      continue;
    }

    // Map old indices to new ones
    [v1, v2, v3].forEach(oldIndex => {
      if (!indexMap.has(oldIndex)) {
        indexMap.set(oldIndex, nextIndex);
        newPositions.push(
          positionArray[oldIndex * 3],
          positionArray[oldIndex * 3 + 1],
          positionArray[oldIndex * 3 + 2]
        );
        nextIndex++;
      }
      newIndices.push(indexMap.get(oldIndex)!);
    });
  }

  // Update geometry with optimized data
  positions.setArray(new Float32Array(newPositions));
  
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
      
      const io = new NodeIO();
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
            
            // Step 3: Apply quantization to further reduce size
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

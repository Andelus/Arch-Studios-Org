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

function optimizeGeometry(primitive: Primitive, document: Document): boolean {
  const positions = primitive.getAttribute('POSITION');
  const normals = primitive.getAttribute('NORMAL');
  const texcoords = primitive.getAttribute('TEXCOORD_0');
  const indices = primitive.getIndices();
  
  if (!positions || !indices) {
    console.error('Missing required position or index data');
    return false;
  }

  const posArray = positions.getArray();
  const normArray = normals?.getArray();
  const texArray = texcoords?.getArray();
  const idxArray = indices.getArray();
  
  if (!posArray || !idxArray) {
    console.error('Could not retrieve array data');
    return false;
  }

  // Safety check for valid arrays
  if (posArray.length % 3 !== 0) {
    console.error('Invalid position array length:', posArray.length);
    return false;
  }

  if (idxArray.length % 3 !== 0) {
    console.error('Invalid index array length:', idxArray.length);
    return false;
  }

  // Convert TypedArrays to regular arrays for processing
  const positionArray = Array.from(posArray);
  const normalArray = normArray ? Array.from(normArray) : null;
  const texcoordArray = texArray ? Array.from(texArray) : null;
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
  const targetCount = Math.floor(sortedVertices.length * 0.15); // Only remove 15% of vertices for better stability
  
  // Remove low-cost vertices
  for (const vertex of sortedVertices) {
    if (removedVertices.size >= targetCount) break;
    
    // Don't remove vertices that would create degenerate triangles
    let canRemove = true;
    for (let i = 0; i < indexArray.length; i += 3) {
      const v1 = indexArray[i];
      const v2 = indexArray[i + 1];
      const v3 = indexArray[i + 2];
      
      // Check if vertex is part of this triangle
      if (v1 === vertex || v2 === vertex || v3 === vertex) {
        // Check if removing this vertex would make a degenerate triangle
        if ([v1, v2, v3].filter(v => !removedVertices.has(v) && v !== vertex).length < 2) {
          canRemove = false;
          break;
        }
      }
    }
    
    if (canRemove) {
      removedVertices.add(vertex);
    }
  }

  // Create new arrays without removed vertices
  const newPositions: number[] = [];
  const newNormals: number[] = [];
  const newTexcoords: number[] = [];
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

    // Check if indices are in valid range before processing
    if (v1 * 3 + 2 >= positionArray.length || 
        v2 * 3 + 2 >= positionArray.length || 
        v3 * 3 + 2 >= positionArray.length) {
      console.error('Out of range vertex index detected, skipping triangle');
      continue;
    }

    // Map old indices to new ones
    [v1, v2, v3].forEach(oldIndex => {
      if (!indexMap.has(oldIndex)) {
        indexMap.set(oldIndex, nextIndex);
        
        // Add positions
        newPositions.push(
          positionArray[oldIndex * 3],
          positionArray[oldIndex * 3 + 1],
          positionArray[oldIndex * 3 + 2]
        );

        // Add normals if they exist
        if (normalArray && oldIndex * 3 + 2 < normalArray.length) {
          newNormals.push(
            normalArray[oldIndex * 3],
            normalArray[oldIndex * 3 + 1],
            normalArray[oldIndex * 3 + 2]
          );
        }

        // Add texture coordinates if they exist
        if (texcoordArray && oldIndex * 2 + 1 < texcoordArray.length) {
          newTexcoords.push(
            texcoordArray[oldIndex * 2],
            texcoordArray[oldIndex * 2 + 1]
          );
        }

        nextIndex++;
      }
      newIndices.push(indexMap.get(oldIndex)!);
    });
  }

  // Validate new arrays
  if (newPositions.length % 3 !== 0) {
    console.error('Invalid optimized position array length:', newPositions.length);
    return false;
  }

  if (newIndices.length % 3 !== 0) {
    console.error('Invalid optimized index array length:', newIndices.length);
    return false;
  }

  if (newNormals.length > 0 && newNormals.length !== newPositions.length) {
    console.error('Normal array length mismatch:', newNormals.length, 'vs', newPositions.length);
    return false;
  }

  if (newTexcoords.length > 0 && newTexcoords.length !== (newPositions.length / 3) * 2) {
    console.error('Texture coordinate array length mismatch:', newTexcoords.length);
    return false;
  }

  // Update geometry with optimized data
  positions.setArray(new Float32Array(newPositions));
  
  if (normals && newNormals.length > 0) {
    normals.setArray(new Float32Array(newNormals));
  }
  
  if (texcoords && newTexcoords.length > 0) {
    texcoords.setArray(new Float32Array(newTexcoords));
  }
  
  const newIndicesAccessor = document.createAccessor()
    .setType('SCALAR')
    .setArray(new Uint32Array(newIndices));
  
  primitive.setIndices(newIndicesAccessor);
  
  return true;
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
      
      if (!document) {
        throw new Error('Failed to parse model data');
      }

      // Apply optimizations
      const root = document.getRoot();
      if (!root) {
        throw new Error('Model has no root node');
      }

      const scene = root.getDefaultScene() || root.listScenes()[0];
      if (!scene) {
        throw new Error('Model has no valid scene');
      } else {
        // Optimize each mesh in the scene
        for (const mesh of root.listMeshes()) {
          for (const primitive of mesh.listPrimitives()) {
            // Step 1: Keep only essential attributes for rendering
            const attributes = primitive.listAttributes();
            const requiredAttributes = new Set(['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0']);

            for (const attribute of attributes) {
              const name = attribute.getName();
              if (!requiredAttributes.has(name)) {
                primitive.setAttribute(name, null);
              }
            }
            
            // Step 2: Optimize geometry while preserving attributes
            optimizeGeometry(primitive, document);
            
            // Step 3: Apply conservative quantization
            const pos = primitive.getAttribute('POSITION');
            if (pos) {
              const arr = pos.getArray();
              if (arr) {
                const quantized = new Float32Array(arr.length);
                for (let i = 0; i < arr.length; i++) {
                  // Use centimeter precision instead of millimeter for stability
                  quantized[i] = Math.round(arr[i] * 100) / 100;
                }
                pos.setArray(quantized);
              }
            }
          }
        }
      }

      // Ensure we have valid data before converting to binary
      const meshes = root.listMeshes();
      if (meshes.length === 0) {
        throw new Error('Model has no meshes after optimization');
      }

      // Convert back to binary
      const optimizedBuffer = await io.writeBinary(document);

      // Basic validation - check that we have a non-empty buffer
      if (!optimizedBuffer || optimizedBuffer.byteLength === 0) {
        console.error('Generated empty buffer');
        return NextResponse.json({ 
          error: 'Generated model is empty',
          details: 'The optimization process produced an empty buffer'
        }, { status: 500 });
      }

      // Return the optimized model
      return new NextResponse(optimizedBuffer, {
        headers: {
          'Content-Type': 'model/gltf-binary',
          'Content-Disposition': 'attachment; filename="cleaned_model.glb"',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
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

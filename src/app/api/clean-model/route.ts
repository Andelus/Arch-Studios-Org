import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Document, NodeIO, Root, Primitive, Accessor } from '@gltf-transform/core';

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Edge {
  v1: number;
  v2: number;
  cost: number;
  triangles: number[];
}

// Calculate edge collapse cost with improved metric
function calculateEdgeCost(v1: Vector3, v2: Vector3): number {
  // Use squared distance as a simple metric
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  const dz = v2.z - v1.z;
  
  return dx * dx + dy * dy + dz * dz;
}

// Calculate normal for a triangle
function calculateNormal(v1: Vector3, v2: Vector3, v3: Vector3): Vector3 {
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
  
  // Return normalized vector
  const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (length === 0) return { x: 0, y: 0, z: 1 }; // Handle degenerate case
  
  return {
    x: nx / length,
    y: ny / length,
    z: nz / length
  };
}

function optimizeGeometry(primitive: Primitive, document: Document): boolean {
  const positions = primitive.getAttribute('POSITION');
  const normals = primitive.getAttribute('NORMAL');
  const texcoords = primitive.getAttribute('TEXCOORD_0');
  const colors = primitive.getAttribute('COLOR_0');
  const indices = primitive.getIndices();
  
  if (!positions || !indices) {
    console.error('Missing required position or index data');
    return false;
  }

  const posArray = positions.getArray();
  const normArray = normals?.getArray();
  const texArray = texcoords?.getArray();
  const colorsArray = colors?.getArray(); // Renamed to avoid duplicate variable name
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
  const colorArray = colorsArray ? Array.from(colorsArray) : null;
  const indexArray = Array.from(idxArray);

  // Build a map of triangles each vertex belongs to
  const vertexToTriangles = new Map<number, number[]>();
  const triangles: Vector3[][] = [];
  
  for (let i = 0; i < indexArray.length; i += 3) {
    const v1 = indexArray[i];
    const v2 = indexArray[i + 1];
    const v3 = indexArray[i + 2];
    
    const triangleIndex = i / 3;
    
    // Add this triangle to each vertex's list
    [v1, v2, v3].forEach(v => {
      if (!vertexToTriangles.has(v)) {
        vertexToTriangles.set(v, []);
      }
      vertexToTriangles.get(v)!.push(triangleIndex);
    });
    
    // Store triangle vertices for later calculations
    triangles.push([
      {
        x: positionArray[v1 * 3],
        y: positionArray[v1 * 3 + 1],
        z: positionArray[v1 * 3 + 2]
      },
      {
        x: positionArray[v2 * 3],
        y: positionArray[v2 * 3 + 1],
        z: positionArray[v2 * 3 + 2]
      },
      {
        x: positionArray[v3 * 3],
        y: positionArray[v3 * 3 + 1],
        z: positionArray[v3 * 3 + 2]
      }
    ]);
  }
  
  // Build edge list with costs
  const edges: Edge[] = [];
  const processedEdges = new Set<string>();
  
  for (let i = 0; i < indexArray.length; i += 3) {
    const v1 = indexArray[i];
    const v2 = indexArray[i + 1];
    const v3 = indexArray[i + 2];
    
    // Process each edge of the triangle
    const triangleIndex = i / 3;
    const edgePairs = [[v1, v2], [v2, v3], [v3, v1]];
    
    for (const [a, b] of edgePairs) {
      // Use canonical ordering to avoid duplicates
      const edgeKey = a < b ? `${a}-${b}` : `${b}-${a}`;
      
      if (!processedEdges.has(edgeKey)) {
        processedEdges.add(edgeKey);
        
        const p1 = {
          x: positionArray[a * 3],
          y: positionArray[a * 3 + 1],
          z: positionArray[a * 3 + 2]
        };
        
        const p2 = {
          x: positionArray[b * 3],
          y: positionArray[b * 3 + 1],
          z: positionArray[b * 3 + 2]
        };
        
        // Calculate the cost of collapsing this edge
        const cost = calculateEdgeCost(p1, p2);
        
        // Get all triangles this edge is part of
        const trianglesA = vertexToTriangles.get(a) || [];
        const trianglesB = vertexToTriangles.get(b) || [];
        const sharedTriangles = trianglesA.filter(t => trianglesB.includes(t));
        
        edges.push({
          v1: a,
          v2: b,
          cost,
          triangles: sharedTriangles
        });
      }
    }
  }
  
  // Sort edges by cost (lowest first)
  edges.sort((a, b) => a.cost - b.cost);
  
  // Create tracking for valid vertices and edges
  const validVertices = new Set<number>();
  for (let i = 0; i < positionArray.length / 3; i++) {
    validVertices.add(i);
  }
  
  const validTriangles = new Set<number>();
  for (let i = 0; i < triangles.length; i++) {
    validTriangles.add(i);
  }
  
  // Target removing only 10% of vertices (more conservative than original 15%)
  const targetRemovalCount = Math.floor(validVertices.size * 0.1);
  let removedCount = 0;
  
  // Process edges for simplification
  for (const edge of edges) {
    if (removedCount >= targetRemovalCount) break;
    
    const { v1, v2, triangles: edgeTriangles } = edge;
    
    // Skip if either vertex has already been removed
    if (!validVertices.has(v1) || !validVertices.has(v2)) {
      continue;
    }
    
    // Skip if collapsing this edge would create a non-manifold mesh
    let canCollapse = true;
    
    // Check each triangle affected by this collapse
    const affectedTriangles = new Set<number>();
    
    // Get all triangles that include v1 or v2
    const v1Triangles = vertexToTriangles.get(v1) || [];
    const v2Triangles = vertexToTriangles.get(v2) || [];
    
    // Add all these triangles to the affected set
    [...v1Triangles, ...v2Triangles].forEach(t => {
      if (validTriangles.has(t)) {
        affectedTriangles.add(t);
      }
    });
    
    // Check if collapsing would create degenerate triangles
    for (const triangleIndex of affectedTriangles) {
      const i = triangleIndex * 3;
      const tv1 = indexArray[i];
      const tv2 = indexArray[i + 1];
      const tv3 = indexArray[i + 2];
      
      // Will this become a degenerate triangle after collapse?
      if ((tv1 === v1 || tv1 === v2) && (tv2 === v1 || tv2 === v2) ||
          (tv2 === v1 || tv2 === v2) && (tv3 === v1 || tv3 === v2) ||
          (tv3 === v1 || tv3 === v2) && (tv1 === v1 || tv1 === v2)) {
        // This triangle would become degenerate - remove it
        validTriangles.delete(triangleIndex);
      }
    }
    
    // Collapse the edge
    validVertices.delete(v2); // Remove v2
    removedCount++;
    
    // All v2's triangles now belong to v1
    v2Triangles.forEach(t => {
      if (validTriangles.has(t)) {
        // Update triangle indices: v2 -> v1
        const i = t * 3;
        if (indexArray[i] === v2) indexArray[i] = v1;
        if (indexArray[i + 1] === v2) indexArray[i + 1] = v1;
        if (indexArray[i + 2] === v2) indexArray[i + 2] = v1;
        
        // Add this triangle to v1's list if it's not already there
        if (!v1Triangles.includes(t)) {
          v1Triangles.push(t);
        }
      }
    });
    
    // Update v1's triangle list
    vertexToTriangles.set(v1, v1Triangles.filter(t => validTriangles.has(t)));
  }
  
  // Create new arrays with only valid triangles
  const newPositions: number[] = [];
  const newNormals: number[] = [];
  const newTexcoords: number[] = [];
  const newColors: number[] = [];
  const newIndices: number[] = [];
  const indexMap = new Map<number, number>();
  let nextIndex = 0;
  
  // Build new triangles
  for (const triangleIndex of validTriangles) {
    const i = triangleIndex * 3;
    const v1 = indexArray[i];
    const v2 = indexArray[i + 1];
    const v3 = indexArray[i + 2];
    
    // Skip degenerate triangles
    if (v1 === v2 || v2 === v3 || v3 === v1) {
      continue;
    }
    
    // Map old indices to new ones
    [v1, v2, v3].forEach(oldIndex => {
      if (!indexMap.has(oldIndex)) {
        indexMap.set(oldIndex, nextIndex);
        
        // Add positions
        const basePos = oldIndex * 3;
        if (basePos + 2 < positionArray.length) {
          newPositions.push(
            positionArray[basePos],
            positionArray[basePos + 1],
            positionArray[basePos + 2]
          );
        } else {
          console.error('Position index out of bounds:', oldIndex);
          return false; // Return false from the main function
        }

        // Add normals if they exist
        if (normalArray) {
          const baseNorm = oldIndex * 3;
          if (baseNorm + 2 < normalArray.length) {
            newNormals.push(
              normalArray[baseNorm],
              normalArray[baseNorm + 1],
              normalArray[baseNorm + 2]
            );
          }
        }

        // Add texture coordinates if they exist
        if (texcoordArray) {
          const baseTex = oldIndex * 2;
          if (baseTex + 1 < texcoordArray.length) {
            newTexcoords.push(
              texcoordArray[baseTex],
              texcoordArray[baseTex + 1]
            );
          }
        }
        
        // Add colors if they exist
        if (colorArray) {
          const baseColor = oldIndex * 4; // Assuming RGBA
          if (baseColor + 3 < colorArray.length) {
            newColors.push(
              colorArray[baseColor],
              colorArray[baseColor + 1],
              colorArray[baseColor + 2],
              colorArray[baseColor + 3]
            );
          }
        }

        nextIndex++;
      }
    });
    
    // Add triangle indices
    newIndices.push(
      indexMap.get(v1)!,
      indexMap.get(v2)!,
      indexMap.get(v3)!
    );
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

  // Recalculate normals if they exist
  if (normals && newNormals.length > 0) {
    // Clear normals array
    newNormals.length = 0;
    
    // Initialize normals array with zeros
    for (let i = 0; i < newPositions.length; i++) {
      newNormals.push(0);
    }
    
    // Calculate normals for each triangle and accumulate
    for (let i = 0; i < newIndices.length; i += 3) {
      const v1Idx = newIndices[i];
      const v2Idx = newIndices[i + 1];
      const v3Idx = newIndices[i + 2];
      
      const v1 = {
        x: newPositions[v1Idx * 3],
        y: newPositions[v1Idx * 3 + 1],
        z: newPositions[v1Idx * 3 + 2]
      };
      
      const v2 = {
        x: newPositions[v2Idx * 3],
        y: newPositions[v2Idx * 3 + 1],
        z: newPositions[v2Idx * 3 + 2]
      };
      
      const v3 = {
        x: newPositions[v3Idx * 3],
        y: newPositions[v3Idx * 3 + 1],
        z: newPositions[v3Idx * 3 + 2]
      };
      
      const normal = calculateNormal(v1, v2, v3);
      
      // Add this normal to all vertices of the triangle
      [v1Idx, v2Idx, v3Idx].forEach(vIdx => {
        const baseIdx = vIdx * 3;
        newNormals[baseIdx] += normal.x;
        newNormals[baseIdx + 1] += normal.y;
        newNormals[baseIdx + 2] += normal.z;
      });
    }
    
    // Normalize all normals
    for (let i = 0; i < newNormals.length; i += 3) {
      const x = newNormals[i];
      const y = newNormals[i + 1];
      const z = newNormals[i + 2];
      
      const length = Math.sqrt(x * x + y * y + z * z);
      
      if (length > 0) {
        newNormals[i] = x / length;
        newNormals[i + 1] = y / length;
        newNormals[i + 2] = z / length;
      } else {
        // Default normal for degenerate cases
        newNormals[i] = 0;
        newNormals[i + 1] = 0;
        newNormals[i + 2] = 1;
      }
    }
  }

  // Update geometry with optimized data
  positions.setArray(new Float32Array(newPositions));
  
  if (normals && newNormals.length > 0) {
    normals.setArray(new Float32Array(newNormals));
  }
  
  if (texcoords && newTexcoords.length > 0) {
    texcoords.setArray(new Float32Array(newTexcoords));
  }
  
  if (colors && newColors.length > 0) {
    colors.setArray(new Float32Array(newColors));
  }
  
  // Create new indices accessor with appropriate component type
  // Use UNSIGNED_SHORT if possible for better compatibility
  let indexAccessor;
  if (nextIndex <= 65535) {
    indexAccessor = document.createAccessor()
      .setType('SCALAR')
      .setArray(new Uint16Array(newIndices));
  } else {
    indexAccessor = document.createAccessor()
      .setType('SCALAR')
      .setArray(new Uint32Array(newIndices));
  }
  
  primitive.setIndices(indexAccessor);
  
  return true;
}

// More conservative quantization that preserves model integrity
function quantizeAttribute(attribute: Accessor, precision: number = 1000): void {
  if (!attribute) return;
  
  const arr = attribute.getArray();
  if (!arr) return;
  
  const quantized = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    // Use higher precision (e.g., 1000 = millimeter precision for meter-scale models)
    quantized[i] = Math.round(arr[i] * precision) / precision;
  }
  attribute.setArray(quantized);
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { modelUrl, optimizationLevel = 'medium' } = await req.json();
    if (!modelUrl) {
      return NextResponse.json({ error: 'Model URL is required' }, { status: 400 });
    }

    // Set precision based on optimization level
    const precisionLevels = {
      'low': 10000,    // 0.1mm precision (very detailed)
      'medium': 1000,  // 1mm precision (good balance)
      'high': 100      // 1cm precision (more aggressive)
    };
    const precision = precisionLevels[optimizationLevel as keyof typeof precisionLevels] || 1000;
    
    try {
      // Download the model
      const response = await fetch(modelUrl);
      if (!response.ok) {
        throw new Error(`Failed to download model: ${response.statusText}`);
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
          // Step 1: Keep only essential attributes for rendering
          for (const primitive of mesh.listPrimitives()) {
            const attributes = primitive.listAttributes();
            const requiredAttributes = new Set(['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0']);

            for (const attribute of attributes) {
              const name = attribute.getName();
              if (!requiredAttributes.has(name)) {
                primitive.setAttribute(name, null);
              }
            }
          }
          
          // Step 2: Optimize geometry while preserving attributes
          for (const primitive of mesh.listPrimitives()) {
            try {
              const success = optimizeGeometry(primitive, document);
              if (!success) {
                console.warn('Could not optimize primitive, skipping');
              }
            } catch (err) {
              console.error('Error optimizing primitive:', err);
              // Continue with other primitives
            }
          }
          
          // Step 3: Apply quantization with appropriate precision
          for (const primitive of mesh.listPrimitives()) {
            const position = primitive.getAttribute('POSITION');
            if (position) {
              quantizeAttribute(position, precision);
            }
            
            // Use lower precision for texture coordinates
            const texcoord = primitive.getAttribute('TEXCOORD_0');
            if (texcoord) {
              quantizeAttribute(texcoord, 100); // 2 decimal places for UVs
            }
          }
        }
      }

      // Ensure we have valid data before converting to binary
      const meshes = root.listMeshes();
      if (meshes.length === 0) {
        throw new Error('Model has no meshes after optimization');
      }
      
      // Final validation - ensure at least one mesh has triangles
      let hasTriangles = false;
      for (const mesh of meshes) {
        for (const primitive of mesh.listPrimitives()) {
          const indices = primitive.getIndices();
          if (indices && indices.getCount() > 0) {
            hasTriangles = true;
            break;
          }
        }
        if (hasTriangles) break;
      }
      
      if (!hasTriangles) {
        throw new Error('Model has no valid triangles after optimization');
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
          'Content-Disposition': 'attachment; filename="optimized_model.glb"',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } catch (error) {
      console.error('Error processing model:', error);
      return NextResponse.json({ 
        error: 'Failed to optimize model',
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
"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fal } from "@fal-ai/client";
import styles from './ThreeD.module.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import CreditDisplay from '@/components/CreditDisplay';

interface GLTFResult {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  scenes: THREE.Group[];
  cameras: THREE.Camera[];
  asset: {
    copyright?: string;
    generator?: string;
    version?: string;
    minVersion?: string;
    extensions?: any;
    extras?: any;
  };
}

function ThreeDModelingContent() {
  const searchParams = useSearchParams();
  const imageUrl = searchParams?.get('imageUrl') ?? null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<'single' | 'multi'>('single');
  const [multiImages, setMultiImages] = useState<Array<{ url: string; view: string }>>([]);
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedModels, setGeneratedModels] = useState<Array<{url: string; sourceImage?: string}>>([]);
  const [currentModelIndex, setCurrentModelIndex] = useState<number>(0);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Handle incoming image URL
  useEffect(() => {
    if (imageUrl) {
      setSourceImage(decodeURIComponent(imageUrl));
    }
  }, [imageUrl]);

  // Handle model loading when current model changes
  useEffect(() => {
    if (generatedModels[currentModelIndex]?.url) {
      loadModel(generatedModels[currentModelIndex].url);
    }
  }, [currentModelIndex, generatedModels]);

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setSourceImage(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const loadModel = async (modelUrl: string) => {
    if (!canvasRef.current) return;
    
    console.log('Loading 3D model from URL:', modelUrl);

    // Initialize Three.js scene if not already done
    if (!sceneRef.current) {
      console.log('Initializing new Three.js scene');
      initializeScene();
    }

    setIsModelLoaded(false);
    setMessage('Loading 3D model...');
    
    // Add cache busting to URL
    const cacheBustedUrl = new URL(modelUrl);
    cacheBustedUrl.searchParams.append('t', Date.now().toString());

    // Track load attempts
    let loadAttempts = 0;
    const maxAttempts = 3;

    const attemptModelLoad = async () => {
      loadAttempts++;
      console.log(`Attempting to load 3D model (attempt ${loadAttempts}/${maxAttempts})`);

      try {
        // Verify the model URL is accessible before loading
        const modelResponse = await fetch(cacheBustedUrl.toString(), {
          method: 'HEAD',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (!modelResponse.ok) {
          throw new Error(`Model URL not accessible: ${modelResponse.status}`);
        }

        // Load model with enhanced error handling
        const loader = new GLTFLoader();
        const gltf = await new Promise<any>((resolve, reject) => {
          loader.load(
            cacheBustedUrl.toString(),
            (gltf) => resolve(gltf),
            (progress) => {
              const percentComplete = Math.round((progress.loaded / progress.total) * 100);
              setMessage(`Loading 3D model: ${percentComplete}%`);
              console.log(`Loading progress: ${percentComplete}%`);
            },
            (error) => {
              console.error('GLTFLoader error:', error);
              reject(error);
            }
          );
        });

        if (!sceneRef.current) {
          throw new Error('Scene not initialized');
        }

        console.log('Model loaded successfully:', gltf);
        
        const model = gltf.scene;
        model.name = 'currentModel';
        
        // Auto-scale and center model
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = 4 / maxDim;
          model.scale.multiplyScalar(scale);
        }

        // Center the model
        box.setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        
        // Enable shadows and improve materials
        model.traverse((node: any) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.material) {
              node.material.roughness = 0.7;
              node.material.metalness = 0.3;
              // Enable transparency if material has it
              if (node.material.transparent) {
                node.material.opacity = 0.8;
              }
            }
          }
        });

        sceneRef.current.add(model);
        setIsModelLoaded(true);
        setMessage(''); // Clear loading message
        setError(null);

        // Reset camera for better view
        if (cameraRef.current && controlsRef.current) {
          cameraRef.current.position.set(4, 4, 4);
          controlsRef.current.target.set(0, 0, 0);
          controlsRef.current.update();
        }

        // Start animation loop
        startAnimationLoop();

      } catch (error) {
        console.error(`Error loading model (attempt ${loadAttempts}/${maxAttempts}):`, error);
        
        if (loadAttempts < maxAttempts) {
          // Add increasing delay before retry
          const retryDelay = 2000 * loadAttempts;
          setMessage(`Load failed, retrying in ${retryDelay/1000} seconds...`);
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return attemptModelLoad();
        } else {
          setIsModelLoaded(false);
          setError('Failed to load 3D model. Please try again.');
          setMessage('');
        }
      }
    };

    // Start first load attempt
    attemptModelLoad();
  };

  const initializeScene = () => {
    if (!canvasRef.current) return;

    // Initialize scene
    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x111111);

    // Initialize renderer
    rendererRef.current = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true
    });
    rendererRef.current.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    rendererRef.current.shadowMap.enabled = true;
    rendererRef.current.shadowMap.type = THREE.PCFSoftShadowMap;

    // Initialize camera
    const aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
    cameraRef.current = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    cameraRef.current.position.set(4, 4, 4);

    // Initialize controls
    controlsRef.current = new OrbitControls(cameraRef.current, canvasRef.current);
    controlsRef.current.enableDamping = true;
    controlsRef.current.dampingFactor = 0.05;

    // Setup lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    
    sceneRef.current.add(ambientLight);
    sceneRef.current.add(hemisphereLight);
    sceneRef.current.add(directionalLight);

    // Add ground plane
    const planeGeometry = new THREE.PlaneGeometry(10, 10);
    const planeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -2;
    plane.receiveShadow = true;
    sceneRef.current.add(plane);

    // Handle window resize
    const handleResize = () => {
      if (!canvasRef.current || !rendererRef.current || !cameraRef.current) return;
      
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  };

  const startAnimationLoop = () => {
    let animationFrameId: number;
    
    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      
      animationFrameId = requestAnimationFrame(animate);
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };
    
    animate();
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  };

  const generate3DModel = async () => {
    if (!sourceImage && !prompt.trim()) {
      setError('Please provide either an image or a prompt');
      return;
    }
    
    setIsGenerating(true);
    setIsModelLoaded(false);
    setError(null);
    
    try {
      const response = await fetch('/api/generate-3d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          imageUrl: sourceImage,
        }),
      });
      
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.error?.includes('insufficient credits')) {
          setError('Your credits have been exhausted. You need to purchase more credits to continue generating 3D models.');
          return;
        }
        if (response.status === 403 && data.error?.includes('subscription has expired')) {
          setError('Your subscription has expired. Please renew your subscription to continue.');
          return;
        }
        setError(data.error || 'Failed to generate 3D model');
        return;
      }
      
      if (data.modelUrl) {
        console.log('Received model URL:', data.modelUrl);
        
        // Update state in a single batch to ensure synchronization
        setGeneratedModels(prevModels => {
          const newModels = [...prevModels];
          if (newModels.length >= 3) {
            newModels.shift(); // Remove the oldest model
          }
          newModels.push({
            url: data.modelUrl,
            sourceImage: sourceImage || undefined
          });
          
          // Update the current model index in the same batch
          setCurrentModelIndex(newModels.length - 1);
          
          return newModels;
        });
        
        // Load the model directly
        await loadModel(data.modelUrl);
      }
    } catch (error) {
      console.error('Generation error:', error);
      setError('Failed to generate 3D model. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadModel = async () => {
    const currentModel = generatedModels[currentModelIndex];
    if (currentModel?.url) {
      try {
        // Validate the model URL first
        if (!currentModel.url.trim() || !currentModel.url.includes('://')) {
          throw new Error('Invalid model URL format');
        }
        
        setMessage('Preparing model for download...');
        
        try {
          // Verify the model URL is accessible before downloading
          const modelResponse = await fetch(currentModel.url, {
            method: 'HEAD',
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });

          if (!modelResponse.ok) {
            throw new Error(`Model URL not accessible: ${modelResponse.status}`);
          }
        } catch (fetchError) {
          console.error('Error verifying model URL:', fetchError);
          // Continue with download attempt anyway
        }

        // Create a direct download link to the model URL
        const link = document.createElement('a');
        link.href = currentModel.url;
        link.download = `architectural_model_${Date.now()}.glb`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show success message
        setMessage('Model download started!');
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        console.error('Error downloading model:', error);
        setError('Failed to download model. The model URL might be invalid or expired.');
      }
    } else {
      setError('No model URL available for download.');
    }
  };

  const handleNextModel = () => {
    if (currentModelIndex < generatedModels.length - 1) {
      setCurrentModelIndex(currentModelIndex + 1);
    }
  };

  const handlePrevModel = () => {
    if (currentModelIndex > 0) {
      setCurrentModelIndex(currentModelIndex - 1);
    }
  };

  const handleMultiImageUpload = (viewType: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Validate file size
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('Image file size is too large. Please use an image smaller than 10MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const dataUrl = e.target.result as string;
          console.log(`Loaded image for ${viewType} view, size: ${Math.round(dataUrl.length / 1024)}KB`);
          
          setMultiImages(prev => {
            // Remove existing image with same view type if it exists
            const filtered = prev.filter(img => img.view !== viewType);
            return [...filtered, { url: dataUrl, view: viewType }];
          });
        }
      };
      reader.onerror = () => {
        setError('Failed to read image file. Please try another image.');
      };
      reader.readAsDataURL(file);
    }
  };

  const removeMultiImage = (viewType: string) => {
    setMultiImages(prev => prev.filter(img => img.view !== viewType));
  };

  const generateFromMultiImages = async () => {
    if (multiImages.length < 2) {
      setError('Please upload at least 2 images from different views');
      return;
    }

    // Validate that we have valid images
    const invalidImages = multiImages.filter(img => !img.url || (typeof img.url === 'string' && img.url.trim() === ''));
    if (invalidImages.length > 0) {
      setError(`${invalidImages.length} invalid image(s) detected. Please re-upload these images.`);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setMessage('Generating 3D model from multiple images...');
    
    // Log detailed information for debugging
    console.log(`Attempting to generate 3D model from ${multiImages.length} images`);
    console.log('Image sizes in KB:', multiImages.map(img => ({
      view: img.view,
      size: Math.round((img.url?.length || 0) / 1024)
    })));

    try {
      const response = await fetch('/api/generate-3d-multi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrls: multiImages.map(img => img.url)
        }),
      });
      
      const data = await response.json();

      if (!response.ok) {
        // Log the error response for debugging
        console.error('API Error:', response.status, data.error);
        
        if (response.status === 403 && data.error?.includes('insufficient credits')) {
          setError('Your credits have been exhausted. You need to purchase more credits to continue generating 3D models.');
          return;
        }
        if (response.status === 403 && data.error?.includes('subscription has expired')) {
          setError('Your subscription has expired. Please renew your subscription to continue.');
          return;
        }
        if (response.status === 401) {
          setError('Authentication error. Please sign in again.');
          return;
        }
        if (response.status === 400) {
          // Handle validation errors specifically
          if (data.error?.includes('At least 2 images')) {
            setError('Please upload at least 2 images from different views');
          } else if (data.error?.includes('Maximum of 23 images')) {
            setError('Too many images. Please use a maximum of 23 images.');
          } else if (data.error?.includes('invalid')) {
            setError('One or more images are invalid. Please try different images.');
          } else {
            setError(data.error || 'Invalid request. Please check your images.');
          }
          return;
        }
        setError(data.error || 'Failed to generate 3D model');
        return;
      }

      if (data.modelUrl) {
        const newModel = {
          url: data.modelUrl,
          sourceImage: multiImages[0].url
        };

        setGeneratedModels(prev => {
          const newModels = [...prev];
          if (newModels.length >= 3) {
            newModels.shift();
          }
          newModels.push(newModel);
          return newModels;
        });

        setCurrentModelIndex(generatedModels.length);
        await loadModel(data.modelUrl);
      }
    } catch (error) {
      console.error('Error generating 3D model:', error);
      // Check if it's an authentication error
      if (error instanceof Error && error.message.includes('unauthorized')) {
        setError('Session expired. Please sign in again.');
      } else if (error instanceof Error && error.message.includes('404')) {
        setError('Service not found. The API endpoint may be unavailable.');
      } else {
        setError('Failed to generate 3D model. Please try again.');
      }
    } finally {
      setIsGenerating(false);
      setMessage('');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.logoSection}>
          <span className={styles.logoText}>Arch Studios</span>
          <span className={styles.indie}>indie</span>
        </div>
        <Link href="/dashboard" className={styles.backButton}>
          <i className="fa-solid fa-arrow-left"></i>
        </Link>
        <CreditDisplay />
      </div>

      <div className={styles.mainContent}>
        <div className={styles.sidebar}>
          <div className={styles.tabs}>
            <button 
              className={`${styles.tab} ${activeTab === 'single' ? styles.active : ''}`}
              onClick={() => setActiveTab('single')}
            >
              Single Image
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'multi' ? styles.active : ''}`}
              onClick={() => setActiveTab('multi')}
            >
              Multi View
            </button>
          </div>

          {activeTab === 'single' ? (
            <>
              {sourceImage ? (
                <div className={styles.sourceImageContainer}>
                  <h3>Source Image</h3>
                  <img 
                    src={sourceImage} 
                    alt="Source for 3D generation" 
                    className={styles.sourceImagePreview} 
                  />
                </div>
              ) : (
                <div 
                  className={styles.dropArea}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  <i className="fa-solid fa-upload fa-2x"></i>
                  <div>Drag and drop images here</div>
                  <div>or</div>
                  <div>Click anywhere in this area<br/>to select files from your computer</div>
                </div>
              )}

              <div className={styles.promptArea}>
                <label>
                  <span>Additional Details (Optional)</span>
                  <i className="fa-solid fa-circle-info"></i>
                </label>
                <textarea 
                  className={styles.promptInput} 
                  placeholder="Describe any additional details for your 3D model..." 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                ></textarea>
              </div>

              <button 
                className={styles.generateBtn} 
                onClick={generate3DModel}
                disabled={isGenerating || (!sourceImage && !prompt.trim())}
              >
                {isGenerating ? 'Generating 3D Model...' : 'Generate 3D Model'}
              </button>
            </>
          ) : (
            <>
              <div className={styles.multiImageUpload}>
                {[
                  { view: 'front', label: 'Front View' },
                  { view: 'back', label: 'Back View' },
                  { view: 'left', label: 'Left View' }
                ].map(({ view, label }) => {
                  const uploadedImage = multiImages.find(img => img.view === view);
                  return (
                    <div 
                      key={view}
                      className={styles.imageUploadBox}
                      onClick={() => {
                        if (!uploadedImage) {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => handleMultiImageUpload(view)(e as any);
                          input.click();
                        }
                      }}
                    >
                      {uploadedImage ? (
                        <>
                          <img src={uploadedImage.url} alt={`${view} view`} />
                          <button 
                            className={styles.removeBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeMultiImage(view);
                            }}
                          >
                            <i className="fa-solid fa-times"></i>
                          </button>
                          <div className={styles.viewLabel}>{label}</div>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-upload fa-2x"></i>
                          <div className={styles.imageUploadLabel}>{label}</div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <button 
                className={styles.generateBtn} 
                onClick={generateFromMultiImages}
                disabled={isGenerating || multiImages.length < 2}
              >
                {isGenerating ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i> Generating 3D Model...</>
                ) : (
                  <><i className="fa-solid fa-cube"></i> Generate from Multiple Views</>
                )}
              </button>
            </>
          )}
        </div>

        <div className={styles.canvasArea}>
          {message && !error && (
            <div className={styles.loadingMessage}>
              <div className={styles.spinner}></div>
              <p>{message}</p>
            </div>
          )}
          
          <div className={styles.canvas3dContainer}>
            <canvas ref={canvasRef} className={styles.canvas3d}></canvas>
            {error ? (
              <div className={styles.errorMessage}>
                <i className={`fa-solid fa-triangle-exclamation ${styles.errorIcon}`}></i>
                <p>{error}</p>
                {error.includes('credits') && (
                  <Link href="/credit-subscription" className={styles.buyCreditsButton}>
                    Buy More Credits
                  </Link>
                )}
              </div>
            ) : !isModelLoaded && generatedModels.length === 0 && !isGenerating && (
              <div className={styles.emptyCanvas3d}>
                <i className="fa-solid fa-cube fa-3x"></i>
                <p>Your 3D model will appear here</p>
              </div>
            )}
          </div>
          
          {isModelLoaded && generatedModels.length > 0 && (
            <>
              <button 
                className={styles.downloadBtn}
                onClick={() => downloadModel()}
              >
                <i className="fa-solid fa-download"></i>
                <span>Download Model</span>
              </button>
              
              {generatedModels.length > 1 && (
                <div className={styles.modelNavigation}>
                  <button
                    className={styles.navBtn}
                    onClick={handlePrevModel}
                    disabled={currentModelIndex === 0}
                  >
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>
                  <span className={styles.modelCount}>
                    {currentModelIndex + 1} / {generatedModels.length}
                  </span>
                  <button
                    className={styles.navBtn}
                    onClick={handleNextModel}
                    disabled={currentModelIndex === generatedModels.length - 1}
                  >
                    <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ThreeDModeling() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [prompt, setPrompt] = useState<string>('');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);

  // Check authentication on component mount
  useEffect(() => {
    if (!isSignedIn) {
      router.push('/');
    }
  }, [isSignedIn, router]);

  const generate3DModel = async () => {
    if (!isSignedIn) {
      setError('Please sign in to generate 3D models');
      return;
    }

    if (!sourceImage && !prompt.trim()) {
      setError('Please provide either an image or a prompt');
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/generate-3d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          imageUrl: sourceImage,
        }),
      });
      
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please sign in to generate 3D models');
          router.push('/');
        } else if (response.status === 404) {
          // Profile not found - redirect to subscription page
          router.push('/credit-subscription');
          return;
        } else {
          setError(data.error || 'Failed to generate 3D model');
        }
        return;
      }
      
      if (data.modelUrl) {
        setModelUrl(data.modelUrl);
      }
    } catch (error) {
      setError('Failed to generate 3D model. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.loading}>
          <i className="fa-solid fa-spinner fa-spin"></i>
          <p>Loading 3D Modeling...</p>
        </div>
      </div>
    }>
      <ThreeDModelingContent />
    </Suspense>
  );
}
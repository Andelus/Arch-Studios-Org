"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import styles from './ThreeD.module.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

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
  
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedModels, setGeneratedModels] = useState<Array<{url: string; sourceImage?: string}>>([]);
  const [currentModelIndex, setCurrentModelIndex] = useState<number>(0);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
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

    // Initialize Three.js scene
    if (!sceneRef.current) {
      sceneRef.current = new THREE.Scene();
      sceneRef.current.background = new THREE.Color(0x111111);

      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      sceneRef.current.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(5, 5, 5);
      sceneRef.current.add(directionalLight);

      // Camera setup
      const aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
      cameraRef.current = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
      cameraRef.current.position.z = 5;

      // Renderer setup
      rendererRef.current = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
      });
      rendererRef.current.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);

      // Controls setup
      if (cameraRef.current) {
        controlsRef.current = new OrbitControls(cameraRef.current, canvasRef.current);
        controlsRef.current.enableDamping = true;
      }
    }

    // Clear existing model
    if (sceneRef.current) {
      const existingModel = sceneRef.current.getObjectByName('currentModel');
      if (existingModel) {
        sceneRef.current.remove(existingModel);
      }
    }

    setIsModelLoaded(false);

    // Load new model
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (!sceneRef.current) return;
        
        const model = gltf.scene;
        model.name = 'currentModel';
        model.position.set(0, 0, 0);
        model.scale.set(1, 1, 1);
        
        // Center model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        
        sceneRef.current.add(model);
        setIsModelLoaded(true);

        // Start animation loop
        const animate = () => {
          if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
          
          requestAnimationFrame(animate);
          if (controlsRef.current) {
            controlsRef.current.update();
          }
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        };
        animate();
      },
      undefined,
      (error) => {
        console.error('Error loading model:', error);
        setIsModelLoaded(false);
        setError('Failed to load 3D model');
      }
    );
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
        setError(data.error || 'Failed to generate 3D model');
        return;
      }
      
      if (data.modelUrl) {
        // Add new model while maintaining 3-tile limit
        setGeneratedModels(prevModels => {
          const newModels = [...prevModels];
          if (newModels.length >= 3) {
            // Remove the oldest model
            newModels.shift();
          }
          // Add the new model
          newModels.push({
            url: data.modelUrl,
            sourceImage: sourceImage || undefined
          });
          return newModels;
        });
        // Show the newly added model
        setCurrentModelIndex(prev => Math.min(2, prev + 1));
      }
    } catch (error) {
      setError('Failed to generate 3D model. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadModel = async () => {
    const currentModel = generatedModels[currentModelIndex];
    if (currentModel?.url) {
      try {
        const response = await fetch(currentModel.url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `architectural_model_${Date.now()}.glb`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error downloading model:', error);
        setError('Failed to download model. Please try again.');
      }
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.logoSection}>
          <span className={styles.logoText}>Arch Studios</span>
          <span className={styles.beta}>BETA</span>
        </div>
        <Link href="/dashboard" className={styles.backButton}>
          <i className="fa-solid fa-arrow-left"></i>
        </Link>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.sidebar}>
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
        </div>

        <div className={styles.canvasArea}>
          <canvas ref={canvasRef} className={styles.canvas3d}></canvas>
          
          {isModelLoaded && generatedModels.length > 0 && (
            <>
              <div className={styles.modelControls}>
                <button 
                  className={styles.downloadBtn}
                  onClick={downloadModel}
                >
                  <i className="fa-solid fa-download"></i>
                  <span>Download 3D Model</span>
                </button>
              </div>
              
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
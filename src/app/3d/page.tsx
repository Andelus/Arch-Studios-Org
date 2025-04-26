"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
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
  const imageUrl = searchParams.get('imageUrl');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setSourceImage(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
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
  
  useEffect(() => {
    if (imageUrl) {
      setSourceImage(imageUrl);
    }
  }, [imageUrl]);
  
  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      // Initialize Three.js scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;
      
      // Set up background gradient
      scene.background = new THREE.Color(0x1a1a2e);
      
      // Create camera
      const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.z = 5;
      cameraRef.current = camera;
      
      // Set up renderer
      const renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true
      });
      renderer.setSize(window.innerWidth * 0.7, window.innerHeight * 0.7);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      rendererRef.current = renderer;
      
      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(5, 5, 5);
      directionalLight.castShadow = true;
      scene.add(directionalLight);
      
      // Add grid helper for reference
      const gridHelper = new THREE.GridHelper(10, 10);
      scene.add(gridHelper);
      
      // Add orbit controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controlsRef.current = controls;
      
      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        
        if (controlsRef.current) {
          controlsRef.current.update();
        }
        
        if (rendererRef.current && cameraRef.current && sceneRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      };
      
      animate();
      
      // Handle window resize
      const handleResize = () => {
        if (cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = window.innerWidth / window.innerHeight;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(window.innerWidth * 0.7, window.innerHeight * 0.7);
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        rendererRef.current?.dispose();
      };
    }
  }, []);
  
  // Load 3D model when modelUrl is available
  useEffect(() => {
    if (modelUrl && sceneRef.current) {
      setIsModelLoaded(false);
      // Clear existing model if any
      const existingModel = sceneRef.current.getObjectByName('generatedModel');
      if (existingModel) {
        sceneRef.current.remove(existingModel);
      }
      
      const loader = new GLTFLoader();
      
      loader.load(
        modelUrl,
        (gltf: GLTFResult) => {
          const model = gltf.scene;
          model.name = 'generatedModel';
          model.position.set(0, 0, 0);
          model.scale.set(1, 1, 1);
          
          // Center model
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);
          
          sceneRef.current?.add(model);
          setIsModelLoaded(true);
        },
        (xhr: ProgressEvent) => {
          console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
        },
        (error: unknown) => {
          console.error('Error loading model:', error);
          setIsModelLoaded(false);
        }
      );
    }
  }, [modelUrl]);
  
  const generate3DModel = async () => {
    if (!sourceImage && !prompt.trim()) return;
    
    setIsGenerating(true);
    setIsModelLoaded(false);
    
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
      
      if (data.modelUrl) {
        setModelUrl(data.modelUrl);
      }
    } catch (error) {
      console.error('Error generating 3D model:', error);
    } finally {
      setIsGenerating(false);
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
          
          {isModelLoaded && modelUrl && (
            <div className={styles.modelControls}>
              <button 
                className={styles.downloadBtn}
                onClick={() => {
                  if (modelUrl) {
                    const link = document.createElement('a');
                    link.href = modelUrl;
                    link.download = 'architecture_model.glb';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                }}
              >
                <i className="fa-solid fa-download"></i>
                <span>Download 3D Model</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ThreeDModeling() {
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
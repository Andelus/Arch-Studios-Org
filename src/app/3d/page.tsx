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
  const [modelUrl, setModelUrl] = useState<string | null>(null);
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
        setModelUrl(data.modelUrl);
      }
    } catch (error) {
      setError('Failed to generate 3D model. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadModel = async () => {
    if (modelUrl) {
      try {
        const response = await fetch(modelUrl);
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
                onClick={downloadModel}
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
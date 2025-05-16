"use client";
// filepath: /Users/Shared/VScode/Arch Studios/src/components/SimpleModelViewer.tsx
import { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface SimpleModelViewerProps {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  autoRotate?: boolean;
  cameraControls?: boolean;
  ar?: boolean;
}

export default function SimpleModelViewer({
  src,
  alt = 'Model Viewer',
  className = '',
  style = {},
  autoRotate = false,
  cameraControls = true,
  ar = false
}: SimpleModelViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Initialize Three.js scene
    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x222222);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    rendererRef.current = renderer;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75, 
      container.clientWidth / container.clientHeight, 
      0.1, 
      1000
    );
    cameraRef.current = camera;
    camera.position.set(2, 2, 2);
    
    // Controls
    if (cameraControls) {
      const controls = new OrbitControls(camera, canvas);
      controlsRef.current = controls;
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 1;
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(2, 4, 2);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Load the model
    loadModel(src);

    // Handle window resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      if (!renderer || !scene || !camera) return;
      
      animationFrameRef.current = requestAnimationFrame(animate);
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      renderer.render(scene, camera);
    };
    
    animate();

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameRef.current);
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      // Dispose geometries and materials
      if (modelRef.current) {
        modelRef.current.traverse((node: any) => {
          if (node.isMesh) {
            node.geometry.dispose();
            
            if (Array.isArray(node.material)) {
              node.material.forEach((material: THREE.Material) => material.dispose());
            } else {
              node.material.dispose();
            }
          }
        });
      }
    };
  }, [autoRotate, cameraControls, src]);

  // Update autoRotate property when the prop changes
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Load model function
  const loadModel = (modelUrl: string) => {
    if (!sceneRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    // Remove existing model if any
    if (modelRef.current) {
      sceneRef.current.remove(modelRef.current);
      modelRef.current = null;
    }

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        modelRef.current = model;
        
        // Auto-scale and center model
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        if (maxDim > 0) {
          const scale = 1.5 / maxDim;
          model.scale.multiplyScalar(scale);
        }
        
        // Center the model
        box.setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;

        // Enable shadows
        model.traverse((node: any) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        sceneRef.current?.add(model);
        setIsLoading(false);
      },
      (xhr) => {
        // Progress
      },
      (error) => {
        console.error('Error loading model:', error);
        setError('Failed to load model');
        setIsLoading(false);
      }
    );
  };

  useEffect(() => {
    // Update model when src changes
    if (sceneRef.current) {
      loadModel(src);
    }
  }, [src]);

  return (
    <div 
      ref={containerRef}
      className={className}
      style={{ position: 'relative', ...style }}
      role="img"
      aria-label={alt}
    >
      <canvas 
        ref={canvasRef}
        style={{ 
          width: '100%', 
          height: '100%',
          display: 'block'
        }}
      />
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)'
        }}>
          <div>Loading...</div>
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)'
        }}>
          <div style={{ color: '#ff6b6b', textAlign: 'center', padding: '20px' }}>
            <div style={{ marginBottom: '10px' }}>⚠️</div>
            <div>{error}</div>
          </div>
        </div>
      )}
    </div>
  );
}

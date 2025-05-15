import { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import styles from '../app/3d/ThreeD.module.css';

interface ModelViewerProps {
  originalModelUrl: string;
}

export default function ModelViewer({ originalModelUrl }: ModelViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentModelUrl, setCurrentModelUrl] = useState(originalModelUrl);
  const [viewMode, setViewMode] = useState<'original' | 'cleaned'>('original');
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Three.js scene
    const initScene = () => {
      const canvas = canvasRef.current!;
      
      // Scene
      sceneRef.current = new THREE.Scene();
      sceneRef.current.background = new THREE.Color(0x111111);

      // Renderer
      rendererRef.current = new THREE.WebGLRenderer({
        canvas,
        antialias: true
      });
      rendererRef.current.setSize(canvas.clientWidth, canvas.clientHeight);
      rendererRef.current.shadowMap.enabled = true;
      rendererRef.current.shadowMap.type = THREE.PCFSoftShadowMap;

      // Camera
      const aspect = canvas.clientWidth / canvas.clientHeight;
      cameraRef.current = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
      cameraRef.current.position.set(4, 4, 4);

      // Controls
      controlsRef.current = new OrbitControls(cameraRef.current, canvas);
      controlsRef.current.enableDamping = true;
      controlsRef.current.dampingFactor = 0.05;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 5, 5);
      directionalLight.castShadow = true;
      
      sceneRef.current.add(ambientLight);
      sceneRef.current.add(hemisphereLight);
      sceneRef.current.add(directionalLight);

      // Ground plane
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
        if (!canvas || !rendererRef.current || !cameraRef.current) return;
        
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        
        rendererRef.current.setSize(width, height);
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    };

    const cleanup = initScene();
    loadModel(currentModelUrl);

    return () => {
      cleanup?.();
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    loadModel(currentModelUrl);
  }, [currentModelUrl]);

  const loadModel = async (modelUrl: string) => {
    if (!canvasRef.current || !sceneRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      // Remove existing model if any
      const existingModel = sceneRef.current.getObjectByName('currentModel');
      if (existingModel) {
        sceneRef.current.remove(existingModel);
      }

      const loader = new GLTFLoader();
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          modelUrl,
          (gltf) => resolve(gltf),
          undefined,
          (error) => reject(error)
        );
      });

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

      // Enable shadows
      model.traverse((node: any) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          if (node.material) {
            node.material.roughness = 0.7;
            node.material.metalness = 0.3;
          }
        }
      });

      sceneRef.current.add(model);

      // Animation loop
      const animate = () => {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
        
        requestAnimationFrame(animate);
        
        if (controlsRef.current) {
          controlsRef.current.update();
        }
        
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      };
      
      animate();

    } catch (error) {
      console.error('Error loading model:', error);
      setError('Failed to load model');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanModel = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/clean-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelUrl: originalModelUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 503 && data.error.includes('Blender is not installed')) {
          throw new Error('Server is not properly configured for model cleaning (Blender not installed)');
        }
        throw new Error(data.error || 'Failed to clean model');
      }

      const blob = await response.blob();
      const cleanedModelUrl = URL.createObjectURL(blob);
      setCurrentModelUrl(cleanedModelUrl);
      setViewMode('cleaned');
    } catch (error) {
      console.error('Error cleaning model:', error);
      setError(error instanceof Error ? error.message : 'Failed to clean model. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modelViewerContainer}>
      <div className={styles.modelControls}>
        <button
          className={`${styles.viewButton} ${viewMode === 'original' ? styles.active : ''}`}
          onClick={() => {
            setCurrentModelUrl(originalModelUrl);
            setViewMode('original');
          }}
          disabled={isLoading}
        >
          🔘 View Original
        </button>
        <button
          className={`${styles.viewButton} ${viewMode === 'cleaned' ? styles.active : ''}`}
          onClick={handleCleanModel}
          disabled={isLoading}
        >
          🔘 Clean Model {isLoading && '(Processing...)'}
        </button>
      </div>
      
      <div className={styles.modelViewer}>
        <canvas 
          ref={canvasRef}
          className={styles.canvas3d}
        />
        {error && (
          <div className={styles.errorMessage}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            <p>{error}</p>
          </div>
        )}
        {isLoading && (
          <div className={styles.loadingMessage}>
            <div className={styles.spinner}></div>
            <p>Processing...</p>
          </div>
        )}
      </div>
    </div>
  );
}

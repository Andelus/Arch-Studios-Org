"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Link from "next/link";
import styles from "./Dashboard.module.css";
import '@fortawesome/fontawesome-free/css/all.min.css';

export default function DashboardPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsDropdownOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !canvasRef.current) return;
    
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    // Create particles
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 1000;
    
    const positionArray = new Float32Array(particleCount * 3);
    const scaleArray = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      positionArray[i * 3] = (Math.random() - 0.5) * 100;
      positionArray[i * 3 + 1] = (Math.random() - 0.5) * 100;
      positionArray[i * 3 + 2] = (Math.random() - 0.5) * 50;
      scaleArray[i] = Math.random() * 2;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
    particleGeometry.setAttribute('scale', new THREE.BufferAttribute(scaleArray, 1));
    
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.3,
      sizeAttenuation: true,
      color: 0xa6c1ee,
      transparent: true,
      opacity: 0.8
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Add architectural lines
    for (let i = 0; i < 15; i++) {
      const lineGeometry = new THREE.BufferGeometry();
      const linePoints = [];
      
      const startPoint = new THREE.Vector3(
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 30
      );
      
      const endPoint = new THREE.Vector3(
        startPoint.x + (Math.random() - 0.5) * 40,
        startPoint.y + (Math.random() - 0.5) * 40,
        startPoint.z + (Math.random() - 0.5) * 20
      );
      
      linePoints.push(startPoint, endPoint);
      lineGeometry.setFromPoints(linePoints);
      
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x5a68e0,
        opacity: 0.3,
        transparent: true
      });
      
      const line = new THREE.Line(lineGeometry, lineMaterial);
      scene.add(line);
    }

    function animate() {
      requestAnimationFrame(animate);
      
      if (particles) {
        particles.rotation.x += 0.0005;
        particles.rotation.y += 0.0008;
      }
      
      camera.position.x = Math.sin(Date.now() * 0.0002) * 5;
      camera.position.y = Math.cos(Date.now() * 0.0001) * 5;
      
      renderer.render(scene, camera);
    }
    
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);
    animate();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      // Clean up Three.js resources
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>
          <span className={styles.logoText}>Arch Studios</span> 
          <span className={styles.beta}>BETA</span>
        </h1>
      </header>
      
      <div className={styles.main}>
        <div className={styles.dashboard}>
          <h2>Arch Tools</h2>
          <div className={styles.dropdown} ref={dropdownRef}>
            <button 
              className={`${styles.dropbtn} ${isDropdownOpen ? styles.active : ''}`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              Select Tool
            </button>
            <div className={`${styles.dropdownContent} ${isDropdownOpen ? styles.show : ''}`}>
              <Link href="/image">Image Generation</Link>
              <Link href="/coming-soon">Render Images</Link>
              <Link href="/3d">3D Modeling</Link>
              <Link href="/credit-subscription">Credit & Subscription</Link>
            </div>
          </div>
        </div>
        
        <div className={styles.contentArea}>
          <div className={styles.pulse}></div>
          <canvas ref={canvasRef} id="animation-canvas"></canvas>
          <div className={styles.contentText}>
            <div className={styles.tagline}>Architectural Intelligence Platform</div>
            <h2>Welcome to Châteaux AI</h2>
            <p>Where architectural vision meets artificial intelligence. Design, iterate, and visualize your projects with unprecedented speed and precision.</p>
          </div>
        </div>
      </div>
    </div>
  );
} 
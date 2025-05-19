"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Link from "next/link";
import { useOrganizationList, useUser } from "@clerk/nextjs";
import styles from "./Dashboard.module.css";
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useSystemTheme } from "../../hooks/useSystemTheme";  // Extend the Window interface to include Clerk
declare global {
  interface Window {
    Clerk?: {
      openCreateOrganization: (options: { 
        afterCreateOrganizationUrl?: string,
        appearance?: any
      }) => void;
      openOrganizationProfile: (
        organizationId: string,
        options?: {
          appearance?: any
        }
      ) => void;
    }
  }
}

export default function DashboardPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [showOrgBanner, setShowOrgBanner] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Use the system theme hook
  const systemTheme = useSystemTheme();
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  
  // Get user and organization data
  const { userMemberships, isLoaded: isOrgListLoaded } = useOrganizationList({ userMemberships: true });
  const { user, isLoaded: isUserLoaded } = useUser();
  const [hasOrganization, setHasOrganization] = useState<boolean | null>(null);

  // Check if user has an organization
  useEffect(() => {
    if (isOrgListLoaded && userMemberships) {
      const hasOrg = userMemberships.data?.length > 0;
      setHasOrganization(hasOrg);
      // Show the organization banner for new users without organizations
      setShowOrgBanner(!hasOrg);
    }
  }, [isOrgListLoaded, userMemberships]);
  
  // Close dropdown when clicking outside
  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsDropdownOpen(false);
    }
    if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target as Node)) {
      setIsOrgDropdownOpen(false);
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
      {showOrgBanner && (
        <div className={styles.orgBanner}>
          <p>Set up your organization to collaborate with team members!</p>
          <div>
            <button 
              className={styles.orgBannerBtn}
              onClick={() => {
                // Open Clerk's organization creation dialog
                if (window.Clerk) {
                  window.Clerk.openCreateOrganization({
                    afterCreateOrganizationUrl: "/dashboard",
                    appearance: {
                      // Use the system theme hook
                      baseTheme: systemTheme,
                      variables: {
                        colorPrimary: "#4facfe",
                      },
                      elements: {
                        // Light mode styles (default)
                        formButtonPrimary: {
                          backgroundColor: "#4facfe",
                          "&:hover": {
                            backgroundColor: "#357abd"
                          }
                        },
                        card: {
                          boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
                          border: "1px solid rgba(0, 0, 0, 0.05)",
                        },
                        input: {
                          border: "1px solid rgba(0, 0, 0, 0.1)"
                        },
                        // Dark mode styles
                        "formButtonPrimary.dark": {
                          backgroundColor: "#4facfe",
                          "&:hover": {
                            backgroundColor: "#357abd"
                          }
                        },
                        "card.dark": {
                          backgroundColor: "#0d0d0d",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)"
                        },
                        "input.dark": {
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          backgroundColor: "rgba(255, 255, 255, 0.05)",
                          color: "#ededed"
                        }
                      }
                    }
                  });
                }
              }}
            >
              Create Organization
            </button>
            <button 
              className={styles.orgBannerClose}
              onClick={() => setShowOrgBanner(false)}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}
      <header className={styles.header}>
        <h1>
          <span className={styles.logoText}>Arch Studios</span> 
          <span className={styles.indie}>indie</span>
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
              <span>Select Tool</span>
              <i className={`fas ${isDropdownOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
            </button>
            <div className={`${styles.dropdownContent} ${isDropdownOpen ? styles.show : ''}`}>
              <Link href="/image" onClick={() => setIsDropdownOpen(false)}>Image Generation</Link>
              <Link href="/coming-soon" onClick={() => setIsDropdownOpen(false)}>Render Images</Link>
              <Link href="/3d" onClick={() => setIsDropdownOpen(false)}>3D Modeling</Link>
              <Link href="/assets" onClick={() => setIsDropdownOpen(false)}>My Assets</Link>
              <Link href="/credit-subscription" onClick={() => setIsDropdownOpen(false)}>Credit & Subscription</Link>
            </div>
          </div>
          
          {/* Organization management section */}
          <div className={styles.orgManagement}>
            <h3>Organization Management</h3>
            {hasOrganization === false ? (
              <div className={styles.noOrgCard}>
                <p>You don't have an organization yet. Create one to collaborate with your team.</p>
                <button 
                  className={styles.setupOrgButton}
                  onClick={() => {
                    // Open Clerk's organization creation modal
                    if (window.Clerk) {
                      window.Clerk.openCreateOrganization({
                        afterCreateOrganizationUrl: "/dashboard",
                        appearance: {
                          // Use the system theme hook
                          baseTheme: systemTheme,
                          variables: {
                            colorPrimary: "#4facfe",
                          },
                          elements: {
                            // Light mode styles (default)
                            card: {
                              boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
                              border: "1px solid rgba(0, 0, 0, 0.05)",
                            },
                            // Dark mode styles
                            "card.dark": {
                              backgroundColor: "#0d0d0d",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)"
                            },
                            formButtonPrimary: {
                              backgroundColor: "#4facfe",
                              "&:hover": {
                                backgroundColor: "#357abd"
                              }
                            },
                            input: {
                              border: "1px solid rgba(255, 255, 255, 0.1)"
                            }
                          }
                        }
                      });
                    }
                  }}
                >
                  Create Organization
                </button>
              </div>
            ) : (
              <div className={styles.dropdown} ref={orgDropdownRef}>
                <button 
                  className={`${styles.dropbtn} ${isOrgDropdownOpen ? styles.active : ''}`}
                  onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                >
                  <span>{hasOrganization ? 'Manage Organization' : 'No Organization Found'}</span>
                  <i className={`fas ${isOrgDropdownOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                </button>
                {hasOrganization && (
                  <div className={`${styles.dropdownContent} ${isOrgDropdownOpen ? styles.show : ''}`}>
                    <Link href="/organization-billing" onClick={() => setIsOrgDropdownOpen(false)}>Organization Billing</Link>
                    <Link href="/analytics" onClick={() => setIsOrgDropdownOpen(false)}>Analytics</Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className={styles.contentArea}>
          <div className={styles.pulse}></div>
          <canvas ref={canvasRef} id="animation-canvas"></canvas>
        </div>
      </div>
    </div>
  );
}
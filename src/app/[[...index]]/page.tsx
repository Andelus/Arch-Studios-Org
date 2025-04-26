"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "../Home.module.css";
import { SignUpButton, useAuth } from "@clerk/nextjs";

export default function Home() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const gridPlaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSignedIn) {
      router.push('/dashboard');
    }
  }, [isSignedIn, router]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!gridPlaneRef.current) return;
      
      const x = (e.clientX / window.innerWidth - 0.5) * 15;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      
      gridPlaneRef.current.style.transform = `rotateX(${60 + y}deg) rotateZ(${x}deg) translateY(0)`;
    };

    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className={styles.container}>
      {/* Enhanced 3D Grid Background */}
      <div className={styles.gridContainer}>
        <div ref={gridPlaneRef} className={styles.gridPlane}></div>
        <div className={styles.vignette}></div>
      </div>
      
      <div className={styles.mainContainer}>
        <nav className={styles.navbar}>
          <div className={styles.logo}>
            <span className={styles.logoText}>Chateaux AI</span>
          </div>
        </nav>
        
        <main className={styles.content}>
          <div className={styles.textContent}>
            <h1 className={styles.mainHeading}>Create at the speed<br />of imagination.</h1>
            <SignUpButton mode="modal">
              <button className={styles.loginBtn}>
                Try Arch-1
              </button>
            </SignUpButton>
          </div>
        </main>
      </div>
      
      <footer className={styles.footer}>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
      </footer>
    </div>
  );
} 
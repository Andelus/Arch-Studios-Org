"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import styles from "./Image.module.css";
import '@fortawesome/fontawesome-free/css/all.min.css';
import CreditDisplay from '@/components/CreditDisplay';
import Image from 'next/image';

interface StyleModifier {
  promptPrefix?: string;
  promptSuffix?: string;
  renderingModifiers?: string;
}

const ARCHITECTURAL_STYLES = [
  '3D-Optimized',
  'Technical Drawing',
  'Modern',
  'Contemporary',
  'Brutalist',
  'Industrial',
  'Scandinavian',
  'Mediterranean',
  'Minimalist',
  'Traditional',
  'Tropical',
  'Japanese Zen'
] as const;

const MATERIALS = [
  'Glass',
  'Wood',
  'Concrete',
  'Steel',
  'Brick',
  'Stone',
  'Plaster',
  'Aluminum',
  'Copper',
  'Bamboo'
] as const;

const styleModifiers: Record<string, StyleModifier> = {
  '3D-Optimized': {
    promptPrefix: 'Professional architectural visualization in isometric view of',
    promptSuffix: 'with clear geometry, minimal details, and high contrast edges. The model should be perfectly centered with clean lines and precise architectural proportions.',
    renderingModifiers: 'pure white background, clean lighting, soft shadows, simplified geometry, minimal clutter, neutral colors, photorealistic materials, centered composition, architectural visualization'
  },
  'Technical Drawing': {
    promptPrefix: 'Detailed architectural line drawing of',
    promptSuffix: 'in precise technical illustration style with fine line work. Show the facade with architectural details, window frames, and ornamental elements.',
    renderingModifiers: 'black and white technical drawing, pure white background, clean architectural lines, no shading, precise geometric details, professional architectural illustration style, high contrast line work, perfectly straight lines, crisp details'
  }
};

type ArchitecturalStyle = typeof ARCHITECTURAL_STYLES[number];
type Material = typeof MATERIALS[number];

export default function ImageGeneration() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [selectedStyle, setSelectedStyle] = useState<ArchitecturalStyle | ''>('');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | ''>('');
  const [showStyleDropdown, setShowStyleDropdown] = useState<boolean>(false);
  const [showMaterialDropdown, setShowMaterialDropdown] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cleanBackground, setCleanBackground] = useState(false);

  // Check authentication on component mount
  useEffect(() => {
    if (!isSignedIn) {
      router.push('/');
    }
  }, [isSignedIn, router]);

  const handleStyleSelect = (style: ArchitecturalStyle) => {
    setSelectedStyle(style);
    setShowStyleDropdown(false);
  };

  const handleMaterialSelect = (material: Material) => {
    setSelectedMaterial(material);
    setShowMaterialDropdown(false);
  };

  const generateImages = async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      console.log('Starting image generation with params:', {
        prompt: prompt.trim() || '(empty)',
        style: selectedStyle || '(none)',
        material: selectedMaterial || '(none)',
        cleanBackground,
        is3DOptimized: selectedStyle === '3D-Optimized'
      });
      
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style: selectedStyle,
          material: selectedMaterial,
          cleanBackground
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        console.error('Generation failed:', data);
        setError(data.message || data.error || 'Failed to generate image');
        setIsGenerating(false);
        return;
      }

      if (data.warning) {
        console.warn('Generation warning:', data.warning);
      }

      if (!data.url) {
        setError('No image URL received');
        setIsGenerating(false);
        return;
      }

      // Add the new image to the collection
      const newImages = [...generatedImages];
      if (newImages.length >= 3) {
        newImages.shift();
      }
      newImages.push(data.url);
      setGeneratedImages(newImages);
      setCurrentImageIndex(newImages.length - 1);
      setIsGenerating(false);

    } catch (error) {
      console.error('Generation error:', error);
      setError('Failed to generate image. Please try again.');
      setIsGenerating(false);
    }
  };

  const handleNextImage = () => {
    if (currentImageIndex < generatedImages.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const handlePrevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const handleFirstImage = () => {
    setCurrentImageIndex(0);
  };

  const handleLastImage = () => {
    setCurrentImageIndex(generatedImages.length - 1);
  };

  const downloadImage = () => {
    if (generatedImages[currentImageIndex]) {
      try {
        console.log('Downloading image from URL:', generatedImages[currentImageIndex]);
        
        // Create a canvas to handle potential CORS issues
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new window.Image();
        
        img.crossOrigin = 'anonymous'; // Handle CORS
        img.onload = () => {
          // Set canvas dimensions to match the image
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw image on canvas
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            
            // Convert to blob and download
            canvas.toBlob((blob) => {
              if (blob) {
                // Create download link
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `architectural_design_${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                
                // Clean up
                setTimeout(() => {
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }, 100);
              }
            });
          }
        };
        
        img.onerror = (e) => {
          console.error('Error loading image for download:', e);
          alert('Failed to download image. Please try again.');
        };
        
        // Start loading the image
        img.src = generatedImages[currentImageIndex];
      } catch (error) {
        console.error('Download error:', error);
        alert('Failed to download image. Please try again.');
      }
    }
  };

  const handle3DGeneration = () => {
    if (generatedImages[currentImageIndex]) {
      router.push(`/3d?imageUrl=${encodeURIComponent(generatedImages[currentImageIndex])}`);
    }
  };

  const handleEdit = () => {
    router.push(`/image/edit?imageUrl=${encodeURIComponent(generatedImages[currentImageIndex])}`);
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
        <CreditDisplay />
      </div>

      <div className={styles.mainContent}>
        <div className={styles.sidebar}>
          <div className={styles.promptArea}>
            <label>
              <span>Prompt</span>
              <i className="fa-solid fa-circle-info"></i>
            </label>
            <textarea 
              className={styles.promptInput} 
              placeholder="Describe your architectural image..." 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            ></textarea>
          </div>

          <div className={styles.dropdownContainer}>
            <div 
              className={styles.styleSection}
              onClick={() => setShowStyleDropdown(!showStyleDropdown)}
            >
              <span>
                <i className="fa-solid fa-palette"></i>
                <div>Style Modifier</div>
              </span>
              <i className={`fa-solid fa-chevron-${showStyleDropdown ? 'up' : 'right'}`}></i>
            </div>
            {showStyleDropdown && (
              <div className={styles.dropdown}>
                {ARCHITECTURAL_STYLES.map((style) => (
                  <div
                    key={style}
                    className={`${styles.dropdownItem} ${selectedStyle === style ? styles.selected : ''}`}
                    onClick={() => handleStyleSelect(style)}
                  >
                    {style}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedStyle && (
            <div className={styles.optionContainer}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={cleanBackground}
                  onChange={(e) => setCleanBackground(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>Clean White Background</span>
              </label>
              <div className={styles.optionHint}>
                {selectedStyle === '3D-Optimized' 
                  ? 'Creates a pure white (RGB 255,255,255) background with perfect isolation, ideal for 3D modeling'
                  : 'Removes all environmental elements and creates a pure white studio background'}
              </div>
            </div>
          )}

          <div className={styles.dropdownContainer}>
            <div 
              className={styles.presets}
              onClick={() => setShowMaterialDropdown(!showMaterialDropdown)}
            >
              <span>
                <i className="fa-solid fa-cube"></i>
                <div>Material</div>
              </span>
              <i className={`fa-solid fa-chevron-${showMaterialDropdown ? 'up' : 'right'}`}></i>
            </div>
            {showMaterialDropdown && (
              <div className={styles.dropdown}>
                {MATERIALS.map((material) => (
                  <div
                    key={material}
                    className={`${styles.dropdownItem} ${selectedMaterial === material ? styles.selected : ''}`}
                    onClick={() => handleMaterialSelect(material)}
                  >
                    {material}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button 
            className={styles.generateBtn} 
            onClick={generateImages}
            disabled={isGenerating || (!prompt.trim() && (!selectedStyle || !selectedMaterial))}
          >
            {isGenerating ? 'Generating...' : 'Generate Images'}
          </button>
        </div>

        <div className={styles.canvasArea}>
          <div className={styles.canvas}>
            {isGenerating ? (
              <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p>Generating your image...</p>
              </div>
            ) : error ? (
              <div className={styles.errorMessage}>
                <i className={`fa-solid fa-triangle-exclamation ${styles.errorIcon}`}></i>
                <p>{error}</p>
                {error.toLowerCase().includes('credits') && (
                  <Link href="/credit-subscription" className={styles.buyCreditsButton}>
                    Buy More Credits
                  </Link>
                )}
              </div>
            ) : generatedImages.length > 0 ? (
              <>
                <div className={styles.imageContainer}>
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <img
                      src={generatedImages[currentImageIndex]}
                      alt={`Generated image from: ${prompt || 'architectural design'}`}
                      className={styles.generatedImage}
                      loading="eager"
                      decoding="sync"
                      onError={(e) => {
                        console.error('Image load error for URL:', generatedImages[currentImageIndex]);
                        setError('Failed to load the generated image. Please try generating again.');
                      }}
                      style={{
                        opacity: 0,
                        transition: 'opacity 0.3s ease-in-out'
                      }}
                      onLoad={(e) => {
                        const imgElement = e.currentTarget;
                        imgElement.style.opacity = '1';
                        setError(null);
                        console.log('Image loaded successfully:', {
                          width: imgElement.naturalWidth,
                          height: imgElement.naturalHeight,
                          src: imgElement.src
                        });
                      }}
                    />
                  </div>
                </div>
                {generatedImages.length > 1 && (
                  <div className={styles.imageCounter}>
                    {currentImageIndex + 1} / {generatedImages.length}
                  </div>
                )}
              </>
            ) : (
              <div className={styles.imageContainer} />
            )}
            
            {generatedImages.length > 0 && (
              <div className={styles.canvasButtons}>
                <button 
                  className={`${styles.canvasBtn} ${styles.editBtn}`}
                  onClick={handleEdit}
                >
                  <i className="fa-solid fa-pen"></i>
                  <span>Edit</span>
                </button>
                <button 
                  className={`${styles.canvasBtn} ${styles.make3dBtn}`}
                  onClick={handle3DGeneration}
                >
                  <i className="fa-solid fa-cube"></i>
                  <span>Make 3D</span>
                </button>
                <button 
                  className={`${styles.canvasBtn} ${styles.downloadBtn}`}
                  onClick={downloadImage}
                >
                  <i className="fa-solid fa-download"></i>
                  <span>Download Image</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
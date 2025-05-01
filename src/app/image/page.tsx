"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import styles from "./Image.module.css";
import '@fortawesome/fontawesome-free/css/all.min.css';
import CreditDisplay from '@/components/CreditDisplay';
import Image from 'next/image';

const ARCHITECTURAL_STYLES = [
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
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style: selectedStyle,
          material: selectedMaterial,
        }),
      });
      
      if (response.redirected) {
        window.location.href = response.url;
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 403 && errorData.error?.includes('insufficient')) {
          setError('Your credits have been exhausted. You need to purchase more credits to continue generating images.');
          return;
        }
        if (response.status === 403 && errorData.error?.includes('expired')) {
          setError('Your subscription has expired. Please renew your subscription to continue generating images.');
          return;
        }
        if (response.status === 408 || errorData.type === 'TIMEOUT_ERROR') {
          setError('The request took too long to complete. This might be due to high server load. Please try again.');
          return;
        }
        if (errorData.type === 'RATE_LIMIT') {
          setError('The service is currently experiencing high demand. Please wait a moment and try again.');
          return;
        }
        setError(errorData.error || 'Failed to generate images');
        return;
      }

      // Handle the response based on content type
      const contentType = response.headers.get('Content-Type');
      let imageUrl = '';
      let warning = null;
      
      if (contentType?.includes('application/json')) {
        // New format with potential warnings
        const jsonResponse = await response.json();
        imageUrl = jsonResponse.url;
        warning = jsonResponse.warning;
        if (warning) {
          console.warn('Generation warning:', warning);
        }
      } else {
        // Old format with direct URL text
        imageUrl = await response.text();
      }
      
      if (!imageUrl) {
        setError('No image URL received');
        return;
      }
      
      // Ensure we're in the browser before creating an Image
      if (typeof window === 'undefined') {
        setError('Browser environment required');
        return;
      }
      
      // Create a new Image object with increased timeout handling
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      
      // Add loading class to container
      const container = document.querySelector(`.${styles.imageContainer}`);
      if (container) {
        container.classList.add(styles.loading);
      }
      
      // Set a longer timeout for image loading
      const timeoutId = setTimeout(() => {
        if (!img.complete) {
          img.src = ''; // Cancel the image load
          setError('Image loading timed out. Please try again.');
          setIsGenerating(false);
          if (container) {
            container.classList.remove(styles.loading);
          }
        }
      }, 30000); // Increased to 30 second timeout to match backend

      // Track load attempts
      let loadAttempts = 0;
      const maxAttempts = 3;
      
      const attemptLoad = () => {
        loadAttempts++;
        console.log(`Attempting to load image (attempt ${loadAttempts}/${maxAttempts}):`, imageUrl);
        
        img.onload = () => {
          clearTimeout(timeoutId);
          console.log('Image loaded successfully:', imageUrl);
          console.log('Natural size:', img.naturalWidth, 'x', img.naturalHeight);
          
          const newImages = [...generatedImages];
          if (newImages.length >= 3) {
            newImages.shift();
          }
          newImages.push(imageUrl);
          setGeneratedImages(newImages);
          setCurrentImageIndex(newImages.length - 1);
          setIsGenerating(false);
          setError(null);
          
          if (container) {
            container.classList.remove(styles.loading);
          }
        };
        
        img.onerror = (e) => {
          console.error(`Failed to load image (attempt ${loadAttempts}/${maxAttempts}):`, e);
          // Check if the URL is from OpenAI (which might have temporary access tokens)
          if (imageUrl.includes('openai.com') || imageUrl.includes('oaiusercontent.com')) {
            console.warn('Detected OpenAI URL which may have limited token validity');
          }
          
          if (loadAttempts < maxAttempts) {
            // Add a smaller fixed delay before retrying
            setTimeout(() => {
              console.log('Retrying image load...');
              // Add cache-busting parameter for retry
              const retryUrl = new URL(imageUrl);
              retryUrl.searchParams.set('retry', loadAttempts.toString());
              img.src = retryUrl.toString();
            }, 1000); // Fixed 1 second delay between retries
          } else {
            clearTimeout(timeoutId);
            setError('Failed to load the generated image. This could be due to temporary access issues with the image service. Please try generating a new image.');
            setIsGenerating(false);
            if (container) {
              container.classList.remove(styles.loading);
            }
            
            // Try to diagnose the issue
            console.error('All image load attempts failed. Diagnosing...');
            fetch(imageUrl, { 
              method: 'HEAD',
              mode: 'no-cors',
              cache: 'no-cache',
              credentials: 'omit',
              referrerPolicy: 'no-referrer',
            })
            .then(response => {
              console.log('HEAD check result:', {
                status: response.status,
                ok: response.ok,
                type: response.type,
                headers: Object.fromEntries(response.headers.entries())
              });
            })
            .catch(fetchError => {
              console.error('HEAD check failed:', fetchError);
            });
          }
        };
        
        img.src = imageUrl;
      };
      
      // Start first load attempt
      attemptLoad();

    } catch (error: any) {
      console.error('Generation error:', error);
      setError('Failed to generate images. Please try again.');
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
                {error.includes('credits') && (
                  <Link href="/credit-subscription" className={styles.buyCreditsButton}>
                    Buy More Credits
                  </Link>
                )}
              </div>
            ) : generatedImages.length > 0 ? (
              <>
                <div className={styles.imageContainer}>
                  <Image 
                    key={`img-${currentImageIndex}-${Date.now()}`}
                    src={generatedImages[currentImageIndex]} 
                    alt={`Generated image from: ${prompt || 'architectural design'}`} 
                    className={styles.generatedImage}
                    fill
                    priority
                    quality={100}
                    crossOrigin="anonymous"
                    loading="eager"
                    referrerPolicy="no-referrer"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    onError={(e) => {
                      const imgElement = e.currentTarget as HTMLImageElement;
                      const originalSrc = imgElement.src;
                      console.error('Image load error. URL:', originalSrc);
                      
                      // Check if URL points to OpenAI
                      const isOpenAIUrl = originalSrc.includes('openai.com') || originalSrc.includes('oaiusercontent.com');
                      
                      if (isOpenAIUrl) {
                        console.warn('OpenAI image URL detected - these URLs may expire. Will attempt regeneration.');
                        setError('The image URL has expired. Please try generating again.');
                        setIsGenerating(false);
                        return;
                      }
                      
                      // Try to fetch the image directly to check response
                      fetch(originalSrc, { 
                        method: 'GET',
                        mode: 'cors',
                        credentials: 'omit',
                        referrerPolicy: 'no-referrer',
                        headers: {
                          'Cache-Control': 'no-cache',
                          'Pragma': 'no-cache'
                        }
                      })
                        .then(response => {
                          console.log('Direct fetch response:', {
                            ok: response.ok,
                            status: response.status,
                            statusText: response.statusText,
                            headers: Object.fromEntries(response.headers.entries())
                          });
                        })
                        .catch(fetchError => {
                          console.error('Direct fetch error:', fetchError);
                        });

                      // Retry loading with a delay and cache-busting
                      setTimeout(() => {
                        const newImgUrl = new URL(originalSrc);
                        newImgUrl.searchParams.set('t', Date.now().toString());
                        imgElement.src = newImgUrl.toString();
                        console.log('Retrying with cache-busting URL:', newImgUrl.toString());
                      }, 2000);
                    }}
                    style={{
                      opacity: 0,
                      transition: 'opacity 0.3s ease-in-out'
                    }}
                    onLoad={(e) => {
                      const imgElement = e.currentTarget as HTMLImageElement;
                      imgElement.style.opacity = '1';
                      setError(null);
                    }}
                  />
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
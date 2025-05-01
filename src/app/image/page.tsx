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
      // Add a client-side timeout to the entire generation process
      const generationTimeout = setTimeout(() => {
        console.error('Client-side generation timeout reached');
        setIsGenerating(false);
        setError('The image generation process took too long. Please try again.');
      }, 60000); // 60-second overall timeout
      
      console.log('Starting image generation with params:', {
        prompt: prompt.trim() || '(empty)',
        style: selectedStyle || '(none)',
        material: selectedMaterial || '(none)'
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
        }),
      });
      
      console.log('API response received:', {
        status: response.status,
        ok: response.ok,
        redirected: response.redirected,
        contentType: response.headers.get('Content-Type')
      });
      
      if (response.redirected) {
        window.location.href = response.url;
        clearTimeout(generationTimeout);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API error:', errorData);
        
        if (response.status === 403 && errorData.error?.includes('insufficient')) {
          setError('Your credits have been exhausted. You need to purchase more credits to continue generating images.');
        }
        else if (response.status === 403 && errorData.error?.includes('expired')) {
          setError('Your subscription has expired. Please renew your subscription to continue generating images.');
        }
        else if (response.status === 408 || errorData.type === 'TIMEOUT_ERROR') {
          setError('The request took too long to complete. This might be due to high server load. Please try again.');
        }
        else if (errorData.type === 'RATE_LIMIT') {
          setError('The service is currently experiencing high demand. Please wait a moment and try again.');
        }
        else {
          setError(errorData.error || 'Failed to generate images');
        }
        
        setIsGenerating(false);
        clearTimeout(generationTimeout);
        return;
      }

      // Handle the response based on content type
      const contentType = response.headers.get('Content-Type');
      let imageUrl = '';
      let warning = null;
      
      try {
        if (contentType?.includes('application/json')) {
          // New format with potential warnings
          console.log('Processing JSON response');
          const jsonResponse = await response.json();
          console.log('JSON response:', jsonResponse);
          imageUrl = jsonResponse.url;
          warning = jsonResponse.warning;
          if (warning) {
            console.warn('Generation warning:', warning);
          }
        } else {
          // Old format with direct URL text
          console.log('Processing text response');
          imageUrl = await response.text();
          console.log('Received raw image URL:', imageUrl.substring(0, 100) + '...');
        }
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        setError('Error processing the server response. Please try again.');
        setIsGenerating(false);
        clearTimeout(generationTimeout);
        return;
      }
      
      if (!imageUrl) {
        console.error('No image URL in response');
        setError('No image URL received');
        setIsGenerating(false);
        clearTimeout(generationTimeout);
        return;
      }
      
      console.log('Successfully received image URL, beginning load process');
      
      // Clear the generation timeout since we've received a response
      clearTimeout(generationTimeout);
      
      // Create and display the image directly in the component
      displayGeneratedImage(imageUrl);
    } catch (error: any) {
      console.error('Generation error:', error);
      setError('Failed to generate images. Please try again.');
      setIsGenerating(false);
    }
  };
  
  // Separated image display logic for clarity
  const displayGeneratedImage = (imageUrl: string) => {
    console.log('Displaying image from URL:', imageUrl.substring(0, 50) + '...');
    
    // Create a new Image object for preloading
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    
    // Add loading class to container
    const container = document.querySelector(`.${styles.imageContainer}`);
    if (container) {
      container.classList.add(styles.loading);
    }
    
    // Set a timeout for image loading
    const timeoutId = setTimeout(() => {
      if (!img.complete || img.naturalWidth === 0) {
        console.error('Image load timeout reached');
        img.src = ''; // Cancel the image load
        
        // Check if the URL is from OpenAI (which might have temporary access tokens)
        if (imageUrl.includes('openai.com') || imageUrl.includes('oaiusercontent.com')) {
          setError('The OpenAI image URL has expired. This is normal for AI-generated images. Please try generating again.');
        } else {
          setError('Image loading timed out. Please try generating again.');
        }
        
        setIsGenerating(false);
        if (container) {
          container.classList.remove(styles.loading);
        }
      }
    }, 40000); // Increased to 40 second timeout
    
    // Track load attempts
    let loadAttempts = 0;
    const maxAttempts = 3;
    
    const attemptLoad = () => {
      loadAttempts++;
      console.log(`Attempting to load image (attempt ${loadAttempts}/${maxAttempts}):`, imageUrl.substring(0, 50) + '...');
      
      // Preload the image
      img.onload = () => {
        clearTimeout(timeoutId);
        console.log('Image preloaded successfully:', {
          width: img.naturalWidth,
          height: img.naturalHeight,
          complete: img.complete
        });
        
        // If image loaded successfully, update state
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
        const isOpenAIUrl = imageUrl.includes('openai.com') || imageUrl.includes('oaiusercontent.com');
        
        if (isOpenAIUrl && loadAttempts >= 2) {
          clearTimeout(timeoutId);
          console.warn('OpenAI URL detected with multiple failed attempts - likely expired token');
          setError('The image URL has expired. This happens with AI-generated images. Please try generating again.');
          setIsGenerating(false);
          if (container) {
            container.classList.remove(styles.loading);
          }
          return;
        }
        
        if (loadAttempts < maxAttempts) {
          // Add a delay before retrying
          setTimeout(() => {
            console.log('Retrying image load...');
            // Add cache-busting parameter for retry
            const retryUrl = new URL(imageUrl);
            retryUrl.searchParams.set('retry', loadAttempts.toString());
            retryUrl.searchParams.set('t', Date.now().toString());
            img.src = retryUrl.toString();
          }, 2000 * loadAttempts); // Increasing backoff delay
        } else {
          clearTimeout(timeoutId);
          console.error('All image load attempts failed');
          
          // Final attempt with fetch to diagnose
          fetch(imageUrl, { 
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache',
            credentials: 'omit',
          })
          .then(response => {
            console.log('Final HEAD check result:', {
              ok: response.ok,
              status: response.status,
              type: response.type
            });
            
            if (response.ok) {
              // URL is accessible but still won't load in the img tag - might be a CORS issue
              setError('Generated image appears valid but cannot be displayed. This may be due to permission issues. Please try generating again.');
            } else {
              setError('Failed to load the generated image. The image URL might be restricted or no longer valid. Please try generating a new image.');
            }
          })
          .catch(fetchError => {
            console.error('Final fetch check failed:', fetchError);
            setError('Failed to access the generated image. Please try generating again.');
          })
          .finally(() => {
            setIsGenerating(false);
            if (container) {
              container.classList.remove(styles.loading);
            }
          });
        }
      };
      
      // Set image source to start loading
      img.src = imageUrl;
    };
    
    // Start first load attempt
    attemptLoad();
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
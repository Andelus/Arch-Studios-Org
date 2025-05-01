"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import styles from "./Image.module.css";
import '@fortawesome/fontawesome-free/css/all.min.css';
import ErrorComponent from '@/components/ErrorComponent';

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
      
      // Handle redirect errors (like NEXT_REDIRECT)
      if (response.redirected) {
        window.location.href = response.url;
        return;
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        // Handle insufficient credits error specifically
        if (response.status === 403 && data.error?.includes('insufficient credits')) {
          setError('Your credits have been exhausted. You need to purchase more credits to continue generating images.');
          // Add a purchase credits button
          const container = document.querySelector('.error-message');
          if (container) {
            const button = document.createElement('button');
            button.className = 'purchase-credits-button';
            button.textContent = 'Purchase Credits';
            button.onclick = () => window.location.href = '/credit-subscription';
            container.appendChild(button);
          }
          return;
        }
        // Handle subscription expired/cancelled error
        else if (response.status === 403 && data.error?.includes('subscription has expired')) {
          setError('Your subscription has expired. Please renew your subscription to continue.');
          // Add a renew subscription button
          const container = document.querySelector('.error-message');
          if (container) {
            const button = document.createElement('button');
            button.className = 'purchase-credits-button';
            button.textContent = 'Renew Subscription';
            button.onclick = () => window.location.href = '/credit-subscription';
            container.appendChild(button);
          }
          return;
        }
        // Handle other errors
        setError(data.error || 'Failed to generate images');
        return;
      }
      
      if (data.images && data.images.length > 0) {
        console.log('Received images:', data.images);
        
        // Ensure we have the full image URL
        const imageUrl = data.images[0];
        console.log('Processing image URL:', imageUrl);
        
        // Pre-load the image to ensure it's cached
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          console.log('Image loaded successfully:', imageUrl, img.naturalWidth, 'x', img.naturalHeight);
          
          // Add new image while maintaining 3-tile limit
          const newImages = [...generatedImages];
          if (newImages.length >= 3) {
            // Remove the oldest image when limit is reached
            newImages.shift();
          }
          // Add the new image
          newImages.push(imageUrl);
          
          // Update state with new images and set current index to the new image
          setGeneratedImages(newImages);
          setCurrentImageIndex(newImages.length - 1);
          
          // Force a re-render
          setTimeout(() => {
            console.log('Forcing re-render with current image index:', newImages.length - 1);
          }, 100);
        };
        
        img.onerror = (e) => {
          console.error('Failed to load image:', imageUrl, e);
          setError('Failed to load the generated image. Please try again.');
        };
        
        // Start loading the image
        img.src = imageUrl;
      } else {
        console.error('No images received from API');
        setError('No images were generated. Please try again.');
      }
    } catch (error) {
      setError('Failed to generate images. Please try again.');
    } finally {
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
        const img = new Image();
        
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
      <ErrorComponent // Replace error display with ErrorComponent
        error={error}
        onPurchaseCredits={() => window.location.href = '/credit-subscription'}
        onRenewSubscription={() => window.location.href = '/credit-subscription'}
      />
      {/* Remove the error display code below */}
      {/* {error && (
        <div className={styles['error-message']}>
          <div className={styles['error-text']}>{error}</div>
          {error.includes('insufficient credits') && (
            <button 
              className={styles['purchase-button']}
              className="purchase-button"
              onClick={() => window.location.href = '/credit-subscription'}
            >
              Purchase Credits
            </button>
          )}
          {(error.includes('subscription has expired') || error.includes('subscription has been cancelled')) && (
            <button 
              className="purchase-button"
              onClick={() => window.location.href = '/credit-subscription'}
            >
              Renew Subscription
            </button>
          )}
        </div>
      )}
      <ErrorDisplay error={error} />
      {/* Remove the error display code below */}
      {/* {error && (
        <div className="error-message">
          {error}
          {error.includes('insufficient credits') && (
            <button 
              className="purchase-credits-button"
              onClick={() => window.location.href = '/credit-subscription'}
            >
              Purchase Credits
            </button>
          )}
          {(error.includes('subscription has expired') || error.includes('subscription has been cancelled')) && (
            <button 
              className="purchase-credits-button"
              onClick={() => window.location.href = '/credit-subscription'}
            >
              Renew Subscription
            </button>
          )}
        </div>
      )}
      <div className={styles.header}>
        <div className={styles.logoSection}>
          <span className={styles.logoText}>Arch Studios</span>
          <span className={styles.beta}>BETA</span>
        </div>
        <Link href="/dashboard" className={styles.backButton}>
          <i className="fa-solid fa-arrow-left"></i>
        </Link>


      <div className={styles.logoSection}>
        <span className={styles.logoText}>Arch Studios</span>
        <span className={styles.beta}>BETA</span>
      </div>
      <Link href="/dashboard" className={styles.backButton}>
        <i className="fa-solid fa-arrow-left"></i>
      </Link>
    </div>
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
            ) : generatedImages.length > 0 ? (
              <>
                <div className={styles.imageContainer}>
                  <img 
                    key={`img-${currentImageIndex}-${Date.now()}`}
                    src={generatedImages[currentImageIndex]} 
                    alt={`Generated image from: ${prompt || 'architectural design'}`} 
                    className={styles.generatedImage}
                    crossOrigin="anonymous"
                    loading="eager"
                    style={{ display: 'block', width: '100%', height: 'auto' }}
                    onLoad={(e) => {
                      console.log('Image loaded successfully:', e.currentTarget.naturalWidth, 'x', e.currentTarget.naturalHeight);
                      // Force a re-render of the image container
                      e.currentTarget.style.display = 'block';
                    }}
                    onError={(e) => {
                      console.error('Image failed to load:', generatedImages[currentImageIndex]);
                      e.currentTarget.onerror = null; // Prevent infinite loop
                      e.currentTarget.src = '/placeholder-image.png'; // Fallback image
                    }}
                  />
                </div>
                {/* Image counter if multiple images */}
                {generatedImages.length > 1 && (
                  <div className={styles.imageCounter}>
                    {currentImageIndex + 1} / {generatedImages.length}
                  </div>
                )}
              </>
            ) : (
              <div className={styles.emptyCanvas}>
                <p>Your generated images will appear here</p>
              </div>
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
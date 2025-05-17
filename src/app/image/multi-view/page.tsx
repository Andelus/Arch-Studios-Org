"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import styles from "./MultiView.module.css";
import '@fortawesome/fontawesome-free/css/all.min.css';
import CreditDisplay from '@/components/CreditDisplay';

// Available architectural views
const VIEWS = [
  { id: 'front', name: 'Front Elevation', icon: 'fa-building-columns' },
  { id: 'rear', name: 'Rear Elevation', icon: 'fa-building' },
  { id: 'side-left', name: 'Left Side Elevation', icon: 'fa-arrows-left-right-to-line' },
  { id: 'side-right', name: 'Right Side Elevation', icon: 'fa-arrows-right-left-to-line' },
  { id: 'aerial', name: 'Aerial View', icon: 'fa-plane' },
  { id: 'top-down', name: 'Top-down View', icon: 'fa-arrow-down' },
  { id: 'interior-living', name: 'Interior - Living Room', icon: 'fa-couch' },
  { id: 'interior-kitchen', name: 'Interior - Kitchen', icon: 'fa-kitchen-set' },
  { id: 'interior-bedroom', name: 'Interior - Bedroom', icon: 'fa-bed' },
  { id: 'interior-bathroom', name: 'Interior - Bathroom', icon: 'fa-bath' },
  { id: 'interior-office', name: 'Interior - Office', icon: 'fa-briefcase' },
  { id: 'street', name: 'Street View', icon: 'fa-road' },
  { id: 'garden', name: 'Garden View', icon: 'fa-tree' },
  { id: 'night', name: 'Night View', icon: 'fa-moon' },
  { id: 'isometric', name: 'Isometric View', icon: 'fa-cube' },
];

export default function MultiViewGeneration() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedImages, setGeneratedImages] = useState<{view: string, image: string}[]>([]);
  const [selectedViews, setSelectedViews] = useState<string[]>([]);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [quality, setQuality] = useState<'none' | 'minor' | 'major'>('none');
  const [error, setError] = useState<string | null>(null);
  const [generate3D, setGenerate3D] = useState<boolean>(false);
  const [subscription, setSubscription] = useState<'TRIAL' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED'>('TRIAL');
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  // Quality level options
  const qualityLevels = [
    { value: 'none', label: 'Standard', description: 'Basic quality, available to all users' },
    { value: 'minor', label: 'Enhanced', description: 'Better details and composition (requires paid subscription)' },
    { value: 'major', label: 'Premium', description: 'Highest quality with maximum detail (Pro plan only)' }
  ];

  // Check subscription status on component mount and load reference image if available
  useEffect(() => {
    if (!isSignedIn) {
      router.push('/');
      return;
    }

    // Check localStorage for reference image
    if (typeof window !== 'undefined') {
      const storedImage = localStorage.getItem('multiViewReferenceImage');
      if (storedImage) {
        console.log('Reference image loaded from localStorage');
        setReferenceImage(storedImage);
        // Clear the stored image after loading it
        // localStorage.removeItem('multiViewReferenceImage');
      }
    }

    const fetchSubscription = async () => {
      try {
        const response = await fetch('/api/profile');
        const data = await response.json();
        setSubscription(data.subscription_status || 'TRIAL');
        setCurrentPlan(data.subscription_plans?.name || null);
      } catch (error) {
        console.error('Error fetching subscription:', error);
        setSubscription('TRIAL');
        setCurrentPlan(null);
      }
    };

    fetchSubscription();
  }, [isSignedIn, router]);

  // Check if user can access the quality level
  const canAccessQuality = (quality: 'none' | 'minor' | 'major'): boolean => {
    switch (quality) {
      case 'none': // Standard quality
        return true;
      case 'minor': // Enhanced quality
        return subscription === 'ACTIVE';
      case 'major': // Premium quality
        return subscription === 'ACTIVE' && 
               (currentPlan?.toLowerCase() || '').includes('pro');
      default:
        return false;
    }
  };

  // Get tooltip text for quality buttons based on subscription
  const getQualityButtonTooltip = (quality: 'none' | 'minor' | 'major'): string => {
    switch (quality) {
      case 'none':
        return 'Available to all users';
      case 'minor':
        return subscription === 'ACTIVE' 
          ? 'Standard and Pro plan feature' 
          : 'Upgrade to a paid plan to unlock';
      case 'major':
        return subscription === 'ACTIVE' && (currentPlan?.toLowerCase() || '').includes('pro')
          ? 'Pro plan feature'
          : 'Upgrade to Pro plan to unlock';
      default:
        return '';
    }
  };

  // Handle view selection
  const toggleView = (viewId: string) => {
    if (selectedViews.includes(viewId)) {
      setSelectedViews(selectedViews.filter(v => v !== viewId));
    } else {
      if (selectedViews.length < 3) {
        setSelectedViews([...selectedViews, viewId]);
      } else {
        // If already 3 views selected, show error or notification
        setError('Maximum of 3 views can be selected');
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReferenceImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate multi-view images
  const generateImages = async () => {
    if (isGenerating) return;
    if (selectedViews.length === 0) {
      setError('Please select at least one view');
      return;
    }
    if (!prompt.trim()) {
      setError('Please enter a description of what you want to create');
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // Map selected view IDs to their full view objects with names
      const selectedViewObjects = selectedViews.map(viewId => {
        const viewObj = VIEWS.find(v => v.id === viewId);
        return { id: viewId, name: viewObj?.name || viewId };
      });
      
      const response = await fetch('/api/generate-multi-view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          views: selectedViewObjects.map(v => v.name), // Send the view names to the API
          referenceImage,
          quality,
          generate3D
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Generation failed:', data);
        setError(data.message || data.error || 'Failed to generate images');
        setIsGenerating(false);
        return;
      }

      if (data.images && Array.isArray(data.images)) {
        setGeneratedImages(data.images);
        
        // Show success notification
        const notification = document.createElement('div');
        notification.className = styles.notification;
        notification.innerHTML = `
          <i class="fa-solid fa-check-circle"></i> 
          Images successfully generated! (${data.creditsRemaining} credits remaining)
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.classList.add(styles.fadeOut);
          setTimeout(() => {
            document.body.removeChild(notification);
          }, 500);
        }, 3000);
      }

      setIsGenerating(false);
    } catch (error) {
      console.error('Generation error:', error);
      setError('Failed to generate images. Please try again.');
      setIsGenerating(false);
    }
  };

  // Download a single image
  const downloadImage = (image: string, viewName: string) => {
    try {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${image}`;
      link.download = `arch-studios-${viewName.replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download image. Please try again.');
    }
  };

  // Download all images as a ZIP file
  const downloadAllImages = () => {
    // Client-side code to download all images
    generatedImages.forEach((img, index) => {
      setTimeout(() => {
        downloadImage(img.image, img.view);
      }, index * 500); // Slight delay between downloads
    });
  };

  // Handle 3D generation with selected images
  const handle3DGeneration = () => {
    if (generatedImages.length > 0) {
      // Encode all images and send to 3D page
      const encodedImages = generatedImages.map(img => ({
        view: img.view,
        image: `data:image/png;base64,${img.image}`
      }));
      
      router.push(`/3d?multiView=${encodeURIComponent(JSON.stringify(encodedImages))}`);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.logoSection}>
          <span className={styles.logoText}>Arch Studios</span>
          <span className={styles.indie}>indie</span>
        </div>
        <div className={styles.navButtons}>
          <Link href="/dashboard" className={styles.backButton}>
            <i className="fa-solid fa-arrow-left"></i>
          </Link>
          <div className={styles.divider}>|</div>
          <span className={styles.title}>AI Image Generator</span>
        </div>
        <CreditDisplay />
      </div>

      <div className={styles.tabs}>
        <Link href="/image" className={styles.tab}>
          <i className="fa-solid fa-image"></i> Single View
        </Link>
        <Link href="/image/multi-view" className={`${styles.tab} ${styles.active}`}>
          <i className="fa-solid fa-images"></i> Multi-View
        </Link>
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
              placeholder="Describe your architectural design..." 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            ></textarea>
          </div>

          <div className={styles.optionSection}>
            <h3 className={styles.sectionTitle}>
              View Selection <span className={styles.selectionCount}>{selectedViews.length}/3</span>
              <i className="fa-solid fa-info-circle"></i>
              <div className={styles.infoTooltip}>
                Select up to 3 views for your architectural design. Each view costs 100 credits.
              </div>
            </h3>
            <div className={styles.viewsContainer}>
              {VIEWS.map((view) => (
                <div 
                  key={view.id}
                  className={`${styles.viewItem} ${selectedViews.includes(view.id) ? styles.selected : ''}`}
                  onClick={() => toggleView(view.id)}
                >
                  <i className={`fa-solid ${view.icon} ${styles.viewIcon}`}></i>
                  <span className={styles.viewName}>{view.name}</span>
                  {selectedViews.includes(view.id) && <i className="fa-solid fa-check"></i>}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.imageUploadSection}>
            <h3 className={styles.sectionTitle}>
              Upload Reference Image <i className="fa-solid fa-info-circle"></i>
              <div className={styles.infoTooltip}>
                Upload an image that will be used as a reference for the AI generation.
                This is optional but can help guide the style and details.
              </div>
            </h3>
            {!referenceImage ? (
              <div className={styles.uploadPrompt}>
                <label className={styles.uploadButton}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <i className="fa-solid fa-upload"></i> Upload Reference Image
                </label>
              </div>
            ) : (
              <div className={styles.imagePreview}>
                <img src={referenceImage} alt="Reference" />
                <button onClick={() => setReferenceImage(null)} className={styles.resetButton}>
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>
            )}
          </div>

          <div className={styles.qualitySection}>
            <h3 className={styles.sectionTitle}>
              Quality Level <i className="fa-solid fa-info-circle"></i>
              <div className={styles.infoTooltip}>
                Controls the quality and detail level of the generated images:
                <br />• <strong>Standard:</strong> Basic quality (Free)
                <br />• <strong>Enhanced:</strong> Better details and composition (Paid plans only)
                <br />• <strong>Premium:</strong> Highest quality with maximum detail (Pro only)
              </div>
            </h3>
            <div className={styles.qualityButtons}>
              {qualityLevels.map(({ value, label, description }) => {
                const isLocked = !canAccessQuality(value as 'none' | 'minor' | 'major');
                return (
                  <button
                    key={value}
                    className={`${styles.qualityButton} ${quality === value ? styles.activeQuality : ''} ${isLocked ? styles.locked : ''}`}
                    onClick={() => !isLocked && setQuality(value as 'none' | 'minor' | 'major')}
                    title={getQualityButtonTooltip(value as 'none' | 'minor' | 'major')}
                    disabled={isLocked}
                  >
                    {isLocked && <i className="fa-solid fa-lock"></i>}
                    {label}
                    <span className={styles.qualityDescription}>{description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.optionRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={generate3D}
                onChange={(e) => setGenerate3D(e.target.checked)}
                className={styles.checkbox}
              />
              <span>Prepare for 3D Generation</span>
            </label>
            <div className={styles.optionHint}>
              Optimizes images for 3D model generation
            </div>
          </div>

          <button
            className={styles.generateBtn}
            onClick={generateImages}
            disabled={isGenerating || selectedViews.length === 0 || !prompt.trim()}
          >
            {isGenerating ? (
              <><i className="fa-solid fa-spinner fa-spin"></i> Generating...</>
            ) : (
              <>
                <i className="fa-solid fa-wand-magic-sparkles"></i> 
                Generate {selectedViews.length} {selectedViews.length === 1 ? 'View' : 'Views'}
                <span className={styles.creditCost}>{selectedViews.length * 100} credits</span>
              </>
            )}
          </button>
          
          <div className={styles.creditInfo}>
            <i className="fa-solid fa-coins"></i>
            <span>Cost: {selectedViews.length * 100} credits ({selectedViews.length} views × 100 credits)</span>
          </div>
        </div>

        <div className={styles.galleryArea}>
          {error && (
            <div className={styles.errorMessage}>
              <i className={`fa-solid fa-triangle-exclamation ${styles.errorIcon}`}></i>
              <p>{error}</p>
              {error.toLowerCase().includes('credits') && (
                <Link href="/credit-subscription" className={styles.buyCreditsButton}>
                  Buy More Credits
                </Link>
              )}
            </div>
          )}

          {isGenerating ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p>Generating your {selectedViews.length > 1 ? 'images' : 'image'}...</p>
              <div className={styles.loadingDetail}>This may take a minute or two</div>
            </div>
          ) : generatedImages.length > 0 ? (
            <>
              <div className={styles.imagesGrid}>
                {generatedImages.map((img, index) => {
                  // Find view object to get its icon
                  const viewObj = VIEWS.find(v => v.name === img.view);
                  return (
                    <div key={index} className={styles.imageCard}>
                      <div className={styles.imageTitle}>
                        {viewObj && <i className={`fa-solid ${viewObj.icon} ${styles.viewTitleIcon}`}></i>}
                        {img.view}
                      </div>
                      <div className={styles.imageWrapper}>
                        <img 
                          src={`data:image/png;base64,${img.image}`} 
                          alt={`${img.view} view of ${prompt}`} 
                          className={styles.generatedImage}
                          loading="lazy"
                        />
                      </div>
                      <div className={styles.imageActions}>
                        <button 
                          className={styles.actionButton}
                          onClick={() => downloadImage(img.image, img.view)}
                          title="Download image"
                        >
                          <i className="fa-solid fa-download"></i>
                        </button>
                        <button 
                          className={styles.actionButton}
                          onClick={() => router.push(`/coming-soon?mode=edit&image=${encodeURIComponent(`data:image/png;base64,${img.image}`)}`)}
                          title="Edit image"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button 
                          className={styles.actionButton}
                          onClick={() => router.push(`/3d?imageUrl=${encodeURIComponent(`data:image/png;base64,${img.image}`)}`)}
                          title="Create 3D model from this view"
                        >
                          <i className="fa-solid fa-cube"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className={styles.galleryActions}>
                <button 
                  className={styles.galleryButton}
                  onClick={downloadAllImages}
                >
                  <i className="fa-solid fa-download"></i> Download All
                </button>
                
                <button 
                  className={`${styles.galleryButton} ${styles.create3DButton}`}
                  onClick={handle3DGeneration}
                >
                  <i className="fa-solid fa-cube"></i> Create 3D Model
                  <span className={styles.cost3D}>(100 credits)</span>
                </button>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>
                <i className="fa-solid fa-images"></i>
              </div>
              <h3>Multi-View Image Generator</h3>
              <p>
                Generate multiple architectural visualizations from different perspectives with a single prompt.
              </p>
              <div className={styles.emptyStateSteps}>
                <div className={styles.step}>
                  <div className={styles.stepNumber}>1</div>
                  <div className={styles.stepText}>Enter a detailed prompt describing your architectural design</div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNumber}>2</div>
                  <div className={styles.stepText}>Select up to 3 different architectural views</div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNumber}>3</div>
                  <div className={styles.stepText}>Optionally upload a reference image to guide the generation</div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNumber}>4</div>
                  <div className={styles.stepText}>Click "Generate" to create your multi-view images</div>
                </div>
              </div>
              <div className={styles.emptyStateHelp}>
                <i className="fa-solid fa-coins"></i> Each view costs 100 credits
                <br />
                <i className="fa-solid fa-cube"></i> Create a 3D model from multiple views for 100 credits
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from "@clerk/nextjs";
import styles from './ComingSoon.module.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import CreditDisplay from '@/components/CreditDisplay';
import DrawingCanvas from './components/DrawingCanvas';

function ImageEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<'edit' | 'render'>(
    searchParams?.get('mode') === 'edit' ? 'edit' : 'render'
  );
  const [prompt, setPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [drawAssist, setDrawAssist] = useState<'none' | 'minor' | 'major'>('none');
  const [maskImage, setMaskImage] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('interior');
  const [outputType, setOutputType] = useState<string>('3D');
  const [renderStyle, setRenderStyle] = useState<string>('realistic');
  const [outputImage, setOutputImage] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<'TRIAL' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED'>('TRIAL');
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState<'pen' | 'eraser'>('pen');

  useEffect(() => {
    // Redirect if not signed in
    if (!isSignedIn) {
      router.push('/');
      return;
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

  const canAccessQuality = (quality: string): boolean => {
    switch (quality) {
      case 'Standard':
        return true;
      case 'Enhanced':
        return subscription === 'ACTIVE';
      case 'Premium':
        return subscription === 'ACTIVE' && 
               (currentPlan?.toLowerCase() || '').includes('pro');
      default:
        return false;
    }
  };

  const getQualityButtonTooltip = (quality: string): string => {
    switch (quality) {
      case 'Standard':
        return 'Available to all users';
      case 'Enhanced':
        return subscription === 'ACTIVE' 
          ? 'Standard and Pro plan feature' 
          : 'Upgrade to a paid plan to unlock';
      case 'Premium':
        return subscription === 'ACTIVE' && (currentPlan?.toLowerCase() || '').includes('pro')
          ? 'Pro plan feature'
          : 'Upgrade to Pro plan to unlock';
      default:
        return '';
    }
  };

  const qualityLevels: Array<{value: 'none' | 'minor' | 'major'; label: string; description: string}> = [
    { value: 'none', label: 'Standard', description: 'Basic quality, available to all users' },
    { value: 'minor', label: 'Enhanced', description: 'Better details and composition (requires paid subscription)' },
    { value: 'major', label: 'Premium', description: 'Highest quality with maximum detail (Pro plan only)' }
  ];

  React.useEffect(() => {
    if (!searchParams) return;
    const imageFromUrl = searchParams.get('image');
    if (imageFromUrl) {
      setSelectedImage(decodeURIComponent(imageFromUrl));
    }
  }, [searchParams]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMaskCreate = (maskData: string) => {
    setMaskImage(maskData);
  };

  const resetCanvas = () => {
    setSelectedImage(null);
    setMaskImage(null);
    setOutputImage(null);
  };

  const handleSubmit = async () => {
    if (activeTab === 'edit') {
      if (!selectedImage || !maskImage || !prompt) {
        alert('Please upload an image, create a mask, and enter a prompt');
        return;
      }

      if (maskImage === '') {
        alert('Please draw on the area you want to edit');
        return;
      }
    } else {
      if (!prompt) {
        alert('Please enter a description of what you want to create');
        return;
      }
    }

    setIsGenerating(true);

    try {
      const endpoint = activeTab === 'edit' ? '/api/edit-image-openai' : '/api/render-image-openai';
      const body = activeTab === 'edit' ? {
        image: selectedImage,
        mask: maskImage,
        prompt,
        drawAssist
      } : {
        prompt,
        category,
        outputType,
        renderStyle,
        referenceImage: selectedImage,
        quality: drawAssist,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      let errorMessage = 'Failed to process image';
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } else {
          errorMessage = `Server error (${response.status}): The API endpoint might be unavailable`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.image) {
        if (activeTab === 'edit') {
          setSelectedImage(`data:image/png;base64,${data.image}`);
          setMaskImage(null);
        } else {
          const outputImage = `data:image/png;base64,${data.image}`;
          setOutputImage(outputImage);
        }

        const notification = document.createElement('div');
        notification.className = styles.notification;
        notification.innerHTML = `
          <i class="fa-solid fa-check-circle"></i> 
          Image successfully generated! (${data.creditsRemaining} credits remaining)
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.classList.add(styles.fadeOut);
          setTimeout(() => {
            document.body.removeChild(notification);
          }, 500);
        }, 3000);
      }
    } catch (error) {
      console.error('Error during OpenAI image editing:', error);
      alert(`Error during image editing process: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={styles.editorContainer}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <Link href="/dashboard">
            <span className={styles.logoText}>Arch Studios</span>
            <span className={styles.indie}>indie</span>
          </Link>
        </div>
        <div className={styles.credits}>
          <CreditDisplay />
        </div>
      </div>

      <div className={styles.mainContent}>
        <div className={`${styles.sidebar} ${activeTab === 'render' && styles.renderMode}`}>
          <div className={styles.tabs}>
            <button 
              className={`${styles.tab} ${activeTab === 'edit' ? styles.activeTab : ''}`}
              onClick={() => {
                setActiveTab('edit');
                resetCanvas();
              }}
            >
              Edit
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'render' ? styles.activeTab : ''}`}
              onClick={() => {
                setActiveTab('render');
                resetCanvas();
              }}
            >
              Render
            </button>
          </div>

          {activeTab === 'edit' && (
            <>
              <div className={styles.promptSection}>
                <h3 className={styles.sectionTitle}>
                  Image Prompt <i className="fa-solid fa-info-circle"></i>
                  <div className={styles.infoTooltip}>
                    Draw on the image to mark areas you want to change, then describe what should replace those areas. 
                    Our AI will generate the changes based on your description.
                  </div>
                </h3>
                <textarea
                  className={styles.promptInput}
                  placeholder="Describe what you want to create in the masked area..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

              <div className={styles.sketchTools}>
                <h3 className={styles.sectionTitle}>Sketch Tools</h3>
                <div className={styles.toolButtons}>
                  <button 
                    className={`${styles.toolButton} ${drawMode === 'eraser' ? styles.active : ''}`}
                    onClick={() => setDrawMode('eraser')}
                  >
                    <i className="fa-solid fa-eraser"></i>
                  </button>
                  <button 
                    className={`${styles.toolButton} ${drawMode === 'pen' ? styles.active : ''}`}
                    onClick={() => setDrawMode('pen')}
                  >
                    <i className="fa-solid fa-pen"></i>
                  </button>
                </div>
              </div>

              <div className={styles.aiAssist}>
                <h3 className={styles.sectionTitle}>
                  AI Enhancement Level <i className="fa-solid fa-info-circle"></i>
                  <div className={styles.infoTooltip}>
                    Controls how much the AI modifies your image:
                    <br />• <strong>Standard:</strong> Minimal changes, preserves most of the original details
                    <br />• <strong>Enhanced:</strong> Moderate edits, balances between original and new elements (Paid plans only)
                    <br />• <strong>Premium:</strong> Significant changes, prioritizes the new content (Pro only)
                  </div>
                </h3>
                <div className={styles.aiAssistButtons}>
                  {qualityLevels.map(({ value, label, description }) => {
                    const isLocked = !canAccessQuality(label);
                    return (
                      <button
                        key={value}
                        className={`${styles.aiButton} ${drawAssist === value ? styles.activeAi : ''} ${isLocked ? styles.locked : ''}`}
                        onClick={() => !isLocked && setDrawAssist(value)}
                        title={getQualityButtonTooltip(label)}
                        disabled={isLocked}
                      >
                        {isLocked && <i className="fa-solid fa-lock"></i>}
                        {label}
                        <span className={styles.qualityDescription}>{description}</span>
                      </button>
                    );
                  })}
                </div>

                <div className={styles.actionButtons}>
                  <button 
                    className={styles.generateButton} 
                    onClick={handleSubmit}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <><i className="fa-solid fa-spinner fa-spin"></i> Processing</>
                    ) : (
                      <><i className="fa-solid fa-wand-magic-sparkles"></i> Generate with AI</>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'render' && (
            <>
              <div className={styles.imageUploadSection}>
                <h3 className={styles.sectionTitle}>
                  Upload Reference Image <i className="fa-solid fa-info-circle"></i>
                  <div className={styles.infoTooltip}>
                    Upload an image that will be used as a reference for the AI rendering.
                    This could be a sketch, floor plan, or similar architectural design.
                  </div>
                </h3>
                {!selectedImage ? (
                  <div className={styles.uploadPrompt}>
                    <p>Upload a reference image to start</p>
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
                  <>
                    <div className={styles.imagePreview}>
                      <img src={selectedImage} alt="Reference" />
                      <button onClick={resetCanvas} className={styles.resetButton}>
                        <i className="fa-solid fa-times"></i>
                      </button>
                    </div>

                    <div className={styles.renderOptions}>
                      <div className={styles.optionGroup}>
                        <label className={styles.optionLabel}>Category</label>
                        <select className={styles.optionSelect} value={category} onChange={(e) => setCategory(e.target.value)}>
                          <option value="interior">Interior</option>
                          <option value="exterior">Exterior</option>
                          <option value="masterplan">Masterplan</option>
                          <option value="virtual-staging">Virtual Staging</option>
                          <option value="landscape">Landscape</option>
                          <option value="sketch">Sketch to Image</option>
                        </select>
                      </div>

                      <div className={styles.optionGroup}>
                        <label className={styles.optionLabel}>Output Type</label>
                        <select className={styles.optionSelect} value={outputType} onChange={(e) => setOutputType(e.target.value)}>
                          <option value="3D">3D Visualization</option>
                          <option value="photo">Photo</option>
                          <option value="drawing">Drawing</option>
                          <option value="wireframe">Wireframe</option>
                          <option value="construction">Construction</option>
                        </select>
                      </div>

                      <div className={styles.optionGroup}>
                        <label className={styles.optionLabel}>Style</label>
                        <select className={styles.optionSelect} value={renderStyle} onChange={(e) => setRenderStyle(e.target.value)}>
                          <option value="realistic">Realistic</option>
                          <option value="cgi">CGI</option>
                          <option value="night">Night</option>
                          <option value="snow">Snow</option>
                          <option value="rain">Rain</option>
                          <option value="sketch">Sketch</option>
                          <option value="illustration">Illustration</option>
                        </select>
                      </div>

                      <textarea
                        className={styles.promptInput}
                        placeholder="Describe what you want to create..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                    </div>
                    
                    <div className={styles.aiAssist}>
                      <h3 className={styles.sectionTitle}>
                        Quality Level <i className="fa-solid fa-info-circle"></i>
                        <div className={styles.infoTooltip}>
                          Controls the quality and detail level of the generated image:
                          <br />• <strong>Standard:</strong> Basic quality (Free)
                          <br />• <strong>Enhanced:</strong> Better details and composition (Paid plans only)
                          <br />• <strong>Premium:</strong> Highest quality with maximum detail (Pro only)
                        </div>
                      </h3>
                      <div className={styles.aiAssistButtons}>
                        {qualityLevels.map(({ value, label, description }) => {
                          const isLocked = !canAccessQuality(label);
                          return (
                            <button
                              key={value}
                              className={`${styles.aiButton} ${drawAssist === value ? styles.activeAi : ''} ${isLocked ? styles.locked : ''}`}
                              onClick={() => !isLocked && setDrawAssist(value)}
                              title={getQualityButtonTooltip(label)}
                              disabled={isLocked}
                            >
                              {isLocked && <i className="fa-solid fa-lock"></i>}
                              {label}
                              <span className={styles.qualityDescription}>{description}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className={styles.actionButtons}>
                        <button 
                          className={styles.generateButton} 
                          onClick={handleSubmit}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <><i className="fa-solid fa-spinner fa-spin"></i> Processing</>
                          ) : (
                            <><i className="fa-solid fa-wand-magic-sparkles"></i> Generate with AI</>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className={`${styles.canvasContainer} ${activeTab === 'edit' ? styles.splitContainer : ''}`}>
          {activeTab === 'edit' ? (
            <>
              <div className={styles.sourceCanvasWrapper}>
                {!selectedImage ? (
                  <div className={styles.uploadPrompt}>
                    <p>Upload an image to edit</p>
                    <label className={styles.uploadButton}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                      <i className="fa-solid fa-upload"></i> Upload Image
                    </label>
                  </div>
                ) : (
                  <>
                    <div className={styles.canvasHeader}>Source Image</div>
                    <DrawingCanvas 
                      selectedImage={selectedImage} 
                      onMaskCreate={handleMaskCreate}
                      drawMode={drawMode}
                    />
                  </>
                )}
              </div>

              <div className={styles.outputCanvasWrapper}>
                {!selectedImage ? (
                  <div className={styles.placeholderPrompt}>
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    <p>Generated image will appear here</p>
                  </div>
                ) : (
                  <>
                    <div className={styles.canvasHeader}>Generated Image</div>
                    <div className={styles.outputCanvas}>
                      {outputImage ? (
                        <img src={outputImage} alt="Generated" className={styles.generatedImage} />
                      ) : (
                        <div className={styles.placeholderPrompt}>
                          <i className="fa-solid fa-wand-magic-sparkles"></i>
                          <p>Make your selection and click Generate</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className={styles.canvasActions}>
                  <button 
                    className={styles.canvasActionButton}
                    onClick={() => {
                      if (outputImage) {
                        const link = document.createElement('a');
                        link.href = outputImage;
                        link.download = 'arch-studios-edited-image.png';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }
                    }}
                    disabled={!outputImage}
                  >
                    <i className="fa-solid fa-download"></i> Download
                  </button>
                  <button 
                    className={styles.canvasActionButton}
                    onClick={() => {
                      setActiveTab('render');
                      setSelectedImage(outputImage || selectedImage);
                    }}
                    disabled={!selectedImage}
                  >
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Render
                  </button>
                  <button 
                    className={styles.canvasActionButton}
                    onClick={() => {
                      if (selectedImage) {
                        router.push('/3d?image=' + encodeURIComponent(outputImage || selectedImage));
                      }
                    }}
                    disabled={!selectedImage}
                  >
                    <i className="fa-solid fa-cube"></i> Make 3D
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.renderCanvas}>
              {outputImage ? (
                <>
                  <img src={outputImage} alt="Generated render" className={styles.generatedImage} />
                  <div className={styles.canvasActions}>
                    <button 
                      className={styles.canvasActionButton}
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = outputImage;
                        link.download = 'arch-studios-render.png';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <i className="fa-solid fa-download"></i> Download
                    </button>
                    <button 
                      className={styles.canvasActionButton}
                      onClick={() => {
                        setActiveTab('edit');
                        setSelectedImage(outputImage);
                      }}
                    >
                      <i className="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                    <button 
                      className={styles.canvasActionButton}
                      onClick={() => {
                        if (outputImage) {
                          router.push('/3d?image=' + encodeURIComponent(outputImage));
                        }
                      }}
                      disabled={!outputImage}
                    >
                      <i className="fa-solid fa-cube"></i> Make 3D
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.renderPlaceholder}>
                  <i className="fa-solid fa-image"></i>
                  <p>Generated image will appear here</p>
                </div>
              )}
              {isGenerating && (
                <div className={styles.renderLoading}>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <p>Generating your visualization...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ImageEditor() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <ImageEditorContent />
    </Suspense>
  );
}
"use client";

import React, { useRef, useEffect, useState } from 'react';
import styles from './DrawingCanvas.module.css';

interface DrawingCanvasProps {
  selectedImage: string | null;
  onMaskCreate: (maskData: string) => void;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ selectedImage, onMaskCreate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);

  // Initialize canvas context
  useEffect(() => {
    if (canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        setCtx(context);
      }
    }
  }, [canvasRef]);

  // Load image to canvas when selected image changes
  useEffect(() => {
    if (selectedImage && canvasRef.current && ctx) {
      const img = new Image();
      img.onload = () => {
        if (canvasRef.current && ctx) {
          // Set canvas dimensions based on image size, with a moderate maximum size for usability
          const maxWidth = 600; // px, moderate fixed size
          const maxHeight = 450; // px, moderate fixed size
          let width = img.width;
          let height = img.height;

          // Calculate aspect ratio to maintain proportions
          if (width > maxWidth) {
            const ratio = maxWidth / width;
            width = maxWidth;
            height = height * ratio;
          }

          if (height > maxHeight) {
            const ratio = maxHeight / height;
            height = maxHeight;
            width = width * ratio;
          }

          canvasRef.current.width = width;
          canvasRef.current.height = height;

          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
      };
      img.src = selectedImage;
    }
  }, [selectedImage, ctx]);

  // Store last position for smooth brush
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const startDrawing = (e: React.MouseEvent) => {
    if (ctx && selectedImage) {
      setIsDrawing(true);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        lastPos.current = { x, y };

        ctx.beginPath();
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,1)';
        ctx.fillStyle = 'rgba(255,255,255,1)';
        ctx.globalCompositeOperation = 'source-over';
        ctx.moveTo(x, y);

        // Draw a single white dot if the user just clicks
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const draw = (e: React.MouseEvent) => {
    if (isDrawing && ctx && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Draw a line from last position to current
      if (lastPos.current) {
        ctx.beginPath();
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,1)';
        ctx.globalCompositeOperation = 'source-over';
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Draw circles along the path for smoothness
        const steps = Math.ceil(
          Math.hypot(x - lastPos.current.x, y - lastPos.current.y) / (brushSize / 2)
        );
        for (let i = 1; i <= steps; i++) {
          const interpX = lastPos.current.x + (x - lastPos.current.x) * (i / steps);
          const interpY = lastPos.current.y + (y - lastPos.current.y) * (i / steps);

          ctx.beginPath();
          ctx.arc(interpX, interpY, brushSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,1)';
          ctx.fill();
        }
      }
      lastPos.current = { x, y };
    }
  };

  const stopDrawing = () => {
    if (ctx && isDrawing) {
      ctx.closePath();
      setIsDrawing(false);
      lastPos.current = null;

      // Create mask from canvas and send it to parent component
      if (canvasRef.current) {
        // Create a temporary canvas to separate the mask
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasRef.current.width;
        tempCanvas.height = canvasRef.current.height;
        const tempCtx = tempCanvas.getContext('2d');

        if (tempCtx) {
          tempCtx.fillStyle = 'black';
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          tempCtx.globalCompositeOperation = 'destination-out';
          tempCtx.drawImage(canvasRef.current, 0, 0);

          // Pass the mask data to the parent
          onMaskCreate(tempCanvas.toDataURL('image/png'));
        }
      }
    }
  };

  // Fix clearMask: always reset to image and clear mask
  const clearMask = () => {
    if (selectedImage && canvasRef.current && ctx) {
      const img = new Image();
      img.onload = () => {
        if (canvasRef.current && ctx) {
          ctx.globalCompositeOperation = 'source-over';
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
          onMaskCreate(''); // Clear the mask in parent component
        }
      };
      img.src = selectedImage;
    }
  };

  // Touch event handlers for mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (ctx && selectedImage) {
      setIsDrawing(true);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect && e.touches[0]) {
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        lastPos.current = { x, y };

        ctx.beginPath();
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,1)';
        ctx.fillStyle = 'rgba(255,255,255,1)';
        ctx.globalCompositeOperation = 'source-over';
        ctx.moveTo(x, y);

        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (isDrawing && ctx && canvasRef.current && e.touches[0]) {
      const rect = canvasRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      if (lastPos.current) {
        ctx.beginPath();
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,1)';
        ctx.globalCompositeOperation = 'source-over';
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        const steps = Math.ceil(
          Math.hypot(x - lastPos.current.x, y - lastPos.current.y) / (brushSize / 2)
        );
        for (let i = 1; i <= steps; i++) {
          const interpX = lastPos.current.x + (x - lastPos.current.x) * (i / steps);
          const interpY = lastPos.current.y + (y - lastPos.current.y) * (i / steps);

          ctx.beginPath();
          ctx.arc(interpX, interpY, brushSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,1)';
          ctx.fill();
        }
      }
      lastPos.current = { x, y };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (ctx && isDrawing) {
      ctx.closePath();
      setIsDrawing(false);
      lastPos.current = null;

      // Create mask from canvas and send it to parent component
      if (canvasRef.current) {
        // Create a temporary canvas to separate the mask
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasRef.current.width;
        tempCanvas.height = canvasRef.current.height;
        const tempCtx = tempCanvas.getContext('2d');

        if (tempCtx) {
          tempCtx.fillStyle = 'black';
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          tempCtx.globalCompositeOperation = 'destination-out';
          tempCtx.drawImage(canvasRef.current, 0, 0);

          // Pass the mask data to the parent
          onMaskCreate(tempCanvas.toDataURL('image/png'));
        }
      }
    }
  };

  return (
    <div className={styles.canvasToolsContainer}>
      <div className={styles.canvasControlsTop} style={{ position: 'static', marginBottom: 16 }}>
        <div className={styles.toolSelector}>
          <button
            className={styles.toolButton + ' ' + styles.activeTool}
            onClick={() => {}} // No-op, only brush
            aria-label="Brush tool"
          >
            <i className="fa-solid fa-pen"></i> Brush
          </button>
          <button className={styles.toolButton} onClick={clearMask} aria-label="Clear">
            <i className="fa-solid fa-trash"></i> Clear
          </button>
        </div>
        <div className={styles.brushControls}>
          <label htmlFor="brush-size-slider">Brush Size: {brushSize}px</label>
          <input
            id="brush-size-slider"
            type="range"
            min="5"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className={styles.brushSizeSlider}
          />
        </div>
      </div>

      {selectedImage ? (
        <div className={styles.canvasWrapper}>
          <canvas
            ref={canvasRef}
            className={styles.editCanvas}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            aria-label="Drawing canvas"
          />
          <div className={styles.canvasInstructions}>
            <p>
              <i className="fa-solid fa-info-circle"></i>
              Draw on the areas you want to edit
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.loadingCanvas}>Loading image...</div>
      )}
    </div>
  );
};

export default DrawingCanvas;

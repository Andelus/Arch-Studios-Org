import React, { useRef, useEffect, useState } from 'react';
import styles from '../ComingSoon.module.css';

interface DrawingCanvasProps {
  selectedImage: string | null;
  onMaskCreate: (maskData: string) => void;
  drawMode: 'pen' | 'eraser';
}

export default function DrawingCanvas({ selectedImage, onMaskCreate, drawMode }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [brushSize, setBrushSize] = useState(10);

  useEffect(() => {
    if (!canvasRef.current || !selectedImage) return;

    const canvas = canvasRef.current;
    ctxRef.current = canvas.getContext('2d');
    const ctx = ctxRef.current;
    if (!ctx) return;

    // Load the image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = selectedImage; // TypeScript already checked selectedImage is non-null here
    img.onload = () => {
      // Calculate aspect ratio preserving dimensions
      const aspectRatio = img.width / img.height;
      let width = img.width;
      let height = img.height;
      
      // Max dimensions
      const maxWidth = 800;
      const maxHeight = 600;
      
      if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
      }
      
      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }

      // Set canvas size
      canvas.width = width;
      canvas.height = height;
      setCanvasSize({ width, height });

      // Draw image
      ctx.drawImage(img, 0, 0, width, height);
    };
  }, [selectedImage]);

  const getCoordinates = (event: MouseEvent | Touch): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Scale coordinates
    const scaleX = canvasSize.width / rect.width;
    const scaleY = canvasSize.height / rect.height;

    return {
      x: x * scaleX,
      y: y * scaleY
    };
  };

  const startDrawing = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const ctx = ctxRef.current;
    if (!ctx) return;

    setIsDrawing(true);
    const coordinates = getCoordinates('touches' in event.nativeEvent 
      ? event.nativeEvent.touches[0] 
      : event.nativeEvent);
    if (!coordinates) return;

    ctx.beginPath();
    ctx.moveTo(coordinates.x, coordinates.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = drawMode === 'pen' ? 'white' : 'black';
    ctx.lineWidth = brushSize;
  };

  const draw = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (!isDrawing || !ctxRef.current) return;

    const coordinates = getCoordinates('touches' in event.nativeEvent 
      ? event.nativeEvent.touches[0] 
      : event.nativeEvent);
    if (!coordinates) return;

    const ctx = ctxRef.current;
    ctx.lineTo(coordinates.x, coordinates.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!ctxRef.current) return;
    setIsDrawing(false);
    ctxRef.current.closePath();

    // Create mask data
    if (!canvasRef.current) return;
    
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvasSize.width;
    maskCanvas.height = canvasSize.height;
    const maskCtx = maskCanvas.getContext('2d');

    if (maskCtx) {
      const imageData = ctxRef.current.getImageData(0, 0, canvasSize.width, canvasSize.height);
      maskCtx.putImageData(imageData, 0, 0);
      const maskData = maskCanvas.toDataURL('image/png');
      onMaskCreate(maskData);
    }
  };

  const clearCanvas = () => {
    if (!canvasRef.current || !ctxRef.current || !selectedImage) return;
    
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = selectedImage;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      onMaskCreate('');
    };
  };

  return (
    <div className={styles.canvasToolsContainer}>
      <div className={styles.canvasControlsTop}>
        <div className={styles.brushControls}>
          <label>Brush Size: {brushSize}px</label>
          <input
            type="range"
            min="1"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className={styles.brushSizeSlider}
          />
        </div>
        <button 
          className={styles.canvasActionButton}
          onClick={clearCanvas}
        >
          <i className="fa-solid fa-trash"></i> Clear
        </button>
      </div>
      <div className={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          className={styles.editCanvas}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ 
            cursor: drawMode === 'pen' ? 'crosshair' : 'cell',
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>
    </div>
  );
}

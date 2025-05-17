'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

interface PaymentButtonProps {
  planId: string;
  planName: string;
  price: number;
  autoBuy?: boolean;
}

declare global {
  interface Window {
    FlutterwaveCheckout?: any;
  }
}

export default function PaymentButton({ planId, planName, price, autoBuy = false }: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { isSignedIn, userId } = useAuth();

  const loadFlutterwaveScript = async () => {
    return new Promise<void>((resolve, reject) => {
      if (document.getElementById('flutterwave-script')) {
        resolve();
        return;
      }

      // Clean up any existing Flutterwave objects that might be causing conflicts
      if (typeof window !== 'undefined') {
        // Clean up any existing script with inline event handlers
        const oldScripts = document.querySelectorAll('script[src*="flutterwave"], script[src*="fpnl"]');
        oldScripts.forEach(script => script.remove());

        // Reset any global Flutterwave objects
        if (window.FlutterwaveCheckout) {
          delete window.FlutterwaveCheckout;
        }
      }

      const script = document.createElement('script');
      script.id = 'flutterwave-script';
      script.src = 'https://checkout.flutterwave.com/v3.js';
      script.async = true;
      script.crossOrigin = 'anonymous'; // Add CORS attribute
      
      script.onload = () => {
        console.log('Flutterwave script loaded successfully');
        resolve();
      };
      script.onerror = (e) => {
        console.error('Failed to load Flutterwave script:', e);
        reject(new Error('Failed to load Flutterwave script'));
      };
      
      document.body.appendChild(script);
    });
  };

  const initializeFlutterwaveCheckout = async (publicKey: string, email: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://chateauxai.com';
    
    if (typeof window.FlutterwaveCheckout !== 'function') {
      console.error('Flutterwave checkout not available, trying to initialize payment via server');
      
      // Fallback to server-side payment initialization
      try {
        const response = await fetch('/api/payment/initialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planId: planId,
            autoBuy: autoBuy,
            bypassChecks: true
          }),
        });

        const data = await response.json();
        
        if (response.ok && data.paymentUrl) {
          // Redirect to Flutterwave hosted payment page instead of inline checkout
          window.location.href = data.paymentUrl;
          return Promise.resolve();
        } else {
          throw new Error(data.error || 'Failed to initialize payment');
        }
      } catch (error) {
        console.error('Server-side payment initialization error:', error);
        throw error;
      }
    }

    // Try client-side initialized checkout
    return new Promise<void>((resolve, reject) => {
      try {
        const tx_ref = `chateaux-${Date.now()}`;
        console.log('Initializing Flutterwave checkout with tx_ref:', tx_ref);
        
        // Define onclose handler outside to ensure it's always called
        const handleClose = () => {
          console.log('Flutterwave checkout closed');
          setIsLoading(false);
          resolve();
        };

        // Define callback outside to ensure proper error handling
        const handleCallback = (response: any) => {
          console.log('Flutterwave callback response:', response);
          if (response.status === 'successful') {
            router.push(`/credit-subscription/verify?transaction_id=${response.transaction_id}`);
          } else {
            setError('Payment was not successful');
          }
          resolve();
        };
        
        // Use try-catch inside the checkout initialization
        try {
          window.FlutterwaveCheckout({
            public_key: publicKey,
            tx_ref: tx_ref,
            amount: price,
            currency: 'USD',
            payment_options: 'card',
            customer: {
              email: email,
              name: email.split('@')[0] || 'User',
            },
            customizations: {
              title: 'Chateaux AI',
              description: `Subscribe to ${planName} plan`,
              logo: `${baseUrl}/logo.svg`,
            },
            meta: {
              planId,
              userId,
              autoBuy,
            },
            onclose: handleClose,
            callback: handleCallback
          });
        } catch (e) {
          console.error('Error initializing FlutterwaveCheckout:', e);
          handleClose();
          reject(e);
        }
      } catch (outerError) {
        console.error('Outer error in Flutterwave checkout:', outerError);
        reject(outerError);
      }
    });
  };

  const handlePayment = async () => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try server-side first approach - more reliable and avoids client-side Flutterwave issues
      try {
        const response = await fetch('/api/payment/initialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planId: planId,
            autoBuy: autoBuy,
            bypassChecks: true
          }),
        });

        const data = await response.json();
        
        if (response.ok && data.paymentUrl) {
          // Redirect to Flutterwave hosted payment page
          console.log('Using server-side payment initialization');
          window.location.href = data.paymentUrl;
          return;
        } else {
          console.log('Server-side initialization failed, trying client-side...');
          // If server-side fails, continue with client-side approach
        }
      } catch (serverError) {
        console.warn('Server-side payment initialization failed:', serverError);
        // Continue with client-side approach
      }

      // Client-side approach (fallback)
      const publicKey = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error('Flutterwave configuration missing');
      }

      // Get user's email
      const response = await fetch('/api/profile');
      const profileData = await response.json();
      if (!response.ok) {
        throw new Error(profileData.error || 'Failed to get user profile');
      }

      // Load Flutterwave script
      console.log('Loading Flutterwave script...');
      await loadFlutterwaveScript();

      // Initialize Flutterwave checkout
      console.log('Initializing Flutterwave checkout...');
      await initializeFlutterwaveCheckout(publicKey, profileData.email);
    } catch (err) {
      console.error('Payment initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize payment. Please try again.');
      
      // Add a "Try Again" option
      setTimeout(() => {
        setError(prev => prev ? `${prev} Please try again.` : 'Please try again.');
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <form onSubmit={(e) => {
        e.preventDefault();
        handlePayment();
      }} className="w-full">
        <button
          type="submit"
          disabled={isLoading}
          aria-label="Make payment"
          className={`w-full px-6 py-2 rounded-md font-medium ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white transition-colors`}
        >
          {isLoading ? 'Processing...' : `Buy ${planName} - $${price}`}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-red-500 text-sm mt-2">{error}</p>
      )}
    </div>
  );
}
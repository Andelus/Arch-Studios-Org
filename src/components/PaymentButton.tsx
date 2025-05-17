'use client';

import { useState, useEffect } from 'react';
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
  const { isSignedIn, userId, getToken } = useAuth();
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Get auth token on component mount
  useEffect(() => {
    if (isSignedIn && getToken) {
      getToken().then(token => {
        setAuthToken(token);
        console.log('Auth token retrieved successfully:', !!token);
      }).catch(err => {
        console.error('Failed to get auth token:', err);
      });
    }
  }, [isSignedIn, getToken]);

  const loadFlutterwaveScript = async () => {
    // Existing implementation...
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
    // Existing implementation...
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://chateauxai.com';
    
    if (typeof window.FlutterwaveCheckout !== 'function') {
      console.error('Flutterwave checkout not available, trying to initialize payment via server');
      
      // Fallback to server-side payment initialization
      try {
        const response = await fetch('/api/payment/initialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          },
          credentials: 'include', // Include cookies for session authentication
          body: JSON.stringify({
            planId,
            autoBuy,
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
          // Add loading indicator in the DOM
          const loadingIndicator = document.createElement('div');
          loadingIndicator.id = 'payment-loading-indicator';
          loadingIndicator.style.position = 'fixed';
          loadingIndicator.style.top = '50%';
          loadingIndicator.style.left = '50%';
          loadingIndicator.style.transform = 'translate(-50%, -50%)';
          loadingIndicator.style.padding = '20px';
          loadingIndicator.style.backgroundColor = 'rgba(0,0,0,0.7)';
          loadingIndicator.style.borderRadius = '10px';
          loadingIndicator.style.color = 'white';
          loadingIndicator.style.zIndex = '9999';
          loadingIndicator.textContent = 'Preparing payment form...';
          document.body.appendChild(loadingIndicator);
          
          // Safer implementation of FlutterwaveCheckout to avoid fingerprinting issues
          window.FlutterwaveCheckout({
            public_key: publicKey,
            tx_ref: tx_ref,
            amount: price,
            currency: 'USD',
            payment_options: 'card',
            // Disable fingerprinting to avoid the API key error
            disable_pwb: true,
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
              source: 'client',
            },
            onclose: () => {
              // Remove the loading indicator
              if (document.getElementById('payment-loading-indicator')) {
                document.body.removeChild(loadingIndicator);
              }
              handleClose();
            },
            callback: (response: any) => {
              // Remove the loading indicator
              if (document.getElementById('payment-loading-indicator')) {
                document.body.removeChild(loadingIndicator);
              }
              handleCallback(response);
            }
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
      console.log('User not signed in, redirecting to sign-in page');
      router.push('/sign-in');
      return;
    }
    
    console.log('User authentication state:', { 
      isSignedIn, 
      userId: userId || 'not available',
      hasAuthToken: !!authToken
    });
    
    if (!userId) {
      setError('You must be signed in to make a payment. Please try signing out and signing back in.');
      console.error('User is signed in but userId is missing');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    console.log('Payment button clicked, starting payment process...');

    try {
      // Try server-side first approach - more reliable and avoids client-side Flutterwave issues
      try {
        console.log('Attempting server-side payment initialization...');
        
        // Try to refresh the auth token if not available
        if (!authToken && getToken) {
          try {
            const token = await getToken();
            setAuthToken(token);
            console.log('Auth token refreshed:', !!token);
          } catch (tokenError) {
            console.error('Failed to refresh auth token:', tokenError);
          }
        }
        
        const response = await fetch('/api/payment/initialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          },
          credentials: 'include', // Include cookies for authentication
          body: JSON.stringify({
            planId,
            autoBuy,
            bypassChecks: true
          }),
        });

        const data = await response.json();
        console.log('Server response status:', response.status);
        console.log('Server response:', data);
        
        if (response.ok && data.paymentUrl) {
          // Redirect to Flutterwave hosted payment page
          console.log('Using server-side payment initialization, redirecting to:', data.paymentUrl);
          window.location.href = data.paymentUrl;
          return;
        } else {
          console.log('Server-side initialization failed, trying client-side...');
          
          if (response.status === 401) {
            console.error('Authentication failed. Try signing out and back in again.');
            setError('Authentication failed. Please sign out and sign back in, then try again.');
            setIsLoading(false);
            return;
          }
          
          // If server-side fails for other reasons, continue with client-side approach
        }
      } catch (serverError) {
        console.warn('Server-side payment initialization failed:', serverError);
        console.log('Falling back to client-side payment approach...');
        // Continue with client-side approach
      }

      // Client-side approach (fallback)
      const publicKey = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY;
      console.log('Client-side public key check:', !!publicKey);
      if (!publicKey) {
        throw new Error('Flutterwave configuration missing');
      }

      // Get user's email
      console.log('Fetching user profile...');
      const response = await fetch('/api/profile', {
        headers: {
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        credentials: 'include'
      });
      
      const profileData = await response.json();
      console.log('Profile response status:', response.status);
      console.log('Profile data received:', profileData ? 'Yes' : 'No');
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

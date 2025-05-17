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

      const script = document.createElement('script');
      script.id = 'flutterwave-script';
      script.src = 'https://checkout.flutterwave.com/v3.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Flutterwave script'));
      document.body.appendChild(script);
    });
  };

  const initializeFlutterwaveCheckout = async (publicKey: string, email: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://chateauxai.com';
    
    if (typeof window.FlutterwaveCheckout !== 'function') {
      throw new Error('Flutterwave checkout not available');
    }

    return new Promise<void>((resolve, reject) => {
      window.FlutterwaveCheckout({
        public_key: publicKey,
        tx_ref: `chateaux-${Date.now()}`,
        amount: price,
        currency: 'USD',
        payment_options: 'card',
        customer: {
          email: email,
          name: email.split('@')[0], // Use part of email as name
          userId: userId
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
        onclose: () => {
          setIsLoading(false);
          resolve();
        },
        callback: (response: any) => {
          if (response.status === 'successful') {
            router.push(`/credit-subscription/verify?transaction_id=${response.transaction_id}`);
          } else {
            setError('Payment was not successful');
          }
          resolve();
        }
      });
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
      await loadFlutterwaveScript();

      // Initialize Flutterwave checkout
      await initializeFlutterwaveCheckout(publicKey, profileData.email);
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize payment');
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
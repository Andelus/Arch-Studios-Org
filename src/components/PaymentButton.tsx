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

  const handlePayment = async () => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First get user's email
      const response = await fetch('/api/profile', {
        method: 'GET',
      });

      const profileData = await response.json();
      if (!response.ok) {
        throw new Error(profileData.error || 'Failed to get user profile');
      }

      // Load Flutterwave script if not already loaded
      if (!document.getElementById('flutterwave-script')) {
        const script = document.createElement('script');
        script.id = 'flutterwave-script';
        script.src = 'https://checkout.flutterwave.com/v3.js';
        document.body.appendChild(script);
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://chateauxai.com';
      const publicKey = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY;

      if (!publicKey) {
        throw new Error('Flutterwave configuration missing');
      }
      
      if (typeof window.FlutterwaveCheckout === 'function') {
        window.FlutterwaveCheckout({
          public_key: publicKey,
          tx_ref: `chateaux-${Date.now()}`,
          amount: price,
          currency: 'USD',
          payment_options: 'card',
          redirect_url: `${baseUrl}/credit-subscription/verify`,
          customer: {
            email: profileData.email,
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
          callback: (response: any) => {
            if (response.status === 'successful') {
              router.push(`/credit-subscription/verify?transaction_id=${response.transaction_id}`);
            } else {
              setError('Payment was not successful');
            }
          },
          onclose: () => {
            setIsLoading(false);
          },
        });
      } else {
        throw new Error('Flutterwave checkout not available');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize payment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handlePayment}
        disabled={isLoading}
        className={`px-6 py-2 rounded-md font-medium ${
          isLoading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white transition-colors`}
      >
        {isLoading ? 'Processing...' : `Buy ${planName} - $${price}`}
      </button>
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}
    </div>
  );
} 
import axios from 'axios';

const FLUTTERWAVE_PUBLIC_KEY = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY;
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
const FLUTTERWAVE_ENCRYPTION_KEY = process.env.FLUTTERWAVE_ENCRYPTION_KEY;

interface PaymentData {
  amount: number;
  email: string;
  plan: string;
  userId: string;
  autoBuy: boolean;
}

export const initializePayment = async (data: PaymentData) => {
  if (!FLUTTERWAVE_PUBLIC_KEY || !FLUTTERWAVE_SECRET_KEY) {
    throw new Error('Flutterwave configuration missing');
  }

  // Ensure we have a valid base URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://chateauxai.com';
  const redirectUrl = `${baseUrl}/credit-subscription/verify`;

  // Generate a transaction reference with more uniqueness
  const txRef = `chateaux-${data.userId.substring(0, 8)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    const payload = {
      tx_ref: txRef,
      amount: data.amount,
      currency: 'USD',
      payment_options: 'card,ussd,mpesa,barter,mobilemoneyghana,mobilemoneyrwanda,mobilemoneyzambia,mobilemoneyuganda,banktransfer',
      payment_type: 'card',
      redirect_url: redirectUrl,
      customer: {
        email: data.email,
        name: data.email.split('@')[0], // Derive name from email
      },
      customizations: {
        title: 'Chateaux AI',
        description: `Subscribe to ${data.plan} plan`,
        logo: `${baseUrl}/logo.svg`,
      },
      meta: {
        plan: data.plan,
        userId: data.userId,
        autoBuy: data.autoBuy,
        source: 'api',
      },
      // Add fingerprint configuration to address the API key error
      public_key: FLUTTERWAVE_PUBLIC_KEY,
    };

    console.log('Initializing payment with library:', {
      ...payload,
      public_key: '[REDACTED]', // Don't log the actual key
    });

    const response = await axios.post(
      'https://api.flutterwave.com/v3/payments',
      payload,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error initializing payment:', error);
    throw error;
  }
};

export const verifyPayment = async (transactionId: string) => {
  if (!FLUTTERWAVE_SECRET_KEY) {
    throw new Error('Flutterwave configuration missing');
  }

  try {
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }
};
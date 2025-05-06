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

  try {
    const response = await axios.post(
      'https://api.flutterwave.com/v3/payments',
      {
        tx_ref: `chateaux-${Date.now()}`,
        amount: data.amount,
        currency: 'USD',
        payment_type: 'card',
        redirect_url: redirectUrl,
        customer: {
          email: data.email,
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
        },
      },
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
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
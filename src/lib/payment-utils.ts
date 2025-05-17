// Helper functions for payment processing 
// This file provides utilities to help with Flutterwave payment processing

/**
 * Prepares payment headers with proper caching and authorization
 * @param token The authentication token 
 * @returns Headers for payment API requests
 */
export function getPaymentHeaders(token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Creates a payment payload for Flutterwave with additional parameters
 * to help prevent fingerprinting and "card not permitted" errors
 */
export function createPaymentPayload({
  txRef,
  amount, 
  email, 
  userId,
  planId,
  planName,
  autoBuy = false,
  redirectUrl,
  publicKey,
  baseUrl = '',
  direct = false
}: {
  txRef: string;
  amount: number;
  email: string;
  userId: string;
  planId: string;
  planName: string;
  autoBuy?: boolean;
  redirectUrl: string;
  publicKey?: string;
  baseUrl?: string;
  direct?: boolean;
}) {
  return {
    tx_ref: txRef,
    amount,
    currency: 'USD',
    // Add multiple payment methods to give users options if card fails
    payment_options: 'card,ussd,mpesa,banktransfer',
    payment_type: 'card',
    redirect_url: redirectUrl,
    customer: {
      email,
      name: email.split('@')[0], // Use part of email as name
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
      source: 'api',
      direct,
    },
    // Add the public key to help with fingerprinting issues
    ...(publicKey ? { public_key: publicKey } : {}),
  };
}

/**
 * Checks if a Flutterwave error is related to card permissions
 */
export function isCardPermissionError(error: any): boolean {
  if (!error) return false;
  
  const message = typeof error === 'string' 
    ? error.toLowerCase()
    : error.message?.toLowerCase() || '';
    
  return message.includes('card not permitted') || 
         message.includes('not permitted') ||
         message.includes('permission denied') ||
         message.includes('card declined');
}

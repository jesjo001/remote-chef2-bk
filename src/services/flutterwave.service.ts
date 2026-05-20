import axios from 'axios';

const FLW_BASE = 'https://api.flutterwave.com/v3';

export const verifyFlutterwavePayment = async (transactionId: string | number): Promise<boolean> => {
  try {
    const response = await axios.get(`${FLW_BASE}/transactions/${transactionId}/verify`, {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
    });
    const data = response.data;
    return data.status === 'success' && data.data?.status === 'successful';
  } catch (err) {
    console.error('Flutterwave verification error:', err);
    return false;
  }
};

/**
 * Initiate a Flutterwave payment via API (for backend payment processing)
 */
export const initiateFlutterwavePayment = async (
  amount: number,
  email: string,
  name: string,
  phoneNumber: string,
  txRef: string,
  subscriptionId: string,
  paymentId: string
): Promise<{ 
  success: boolean; 
  data?: { authorization_url?: string; access_code?: string; [key: string]: any };
  error?: string;
}> => {
  try {
    const response = await axios.post(
      `${FLW_BASE}/payments`,
      {
        tx_ref: txRef,
        amount: amount,
        currency: 'NGN',
        payment_options: 'card,banktransfer,ussd',
        redirect_url: `${process.env.FRONTEND_URL}/payment/verify?txRef=${txRef}`,
        customer: {
          email: email,
          name: name,
          phone_number: phoneNumber,
        },
        customizations: {
          title: 'RemoteChef Subscription',
          description: `Subscription #${subscriptionId}`,
          logo: `${process.env.FRONTEND_URL}/logo.png`,
        },
        meta: {
          subscriptionId,
          paymentId,
        },
      },
      {
        headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
      }
    );

    if (response.data.status === 'success') {
      return {
        success: true,
        data: response.data.data,
      };
    } else {
      return {
        success: false,
        error: response.data.message || 'Payment initiation failed',
      };
    }
  } catch (err) {
    console.error('Flutterwave payment initiation error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};

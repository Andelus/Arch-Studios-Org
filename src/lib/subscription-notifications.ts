import { sendEmail } from '@/lib/email-service';

/**
 * Send email notification for organization subscription events
 */
export async function sendSubscriptionNotification(
  event: 'created' | 'cancelled' | 'renewed' | 'payment_failed',
  {
    organizationId,
    organizationName,
    planType,
    adminEmail,
  }: {
    organizationId: string;
    organizationName: string;
    planType: string;
    adminEmail: string;
  }
) {
  const subjectMap = {
    created: `Subscription Activated: ${organizationName}`,
    cancelled: `Subscription Cancelled: ${organizationName}`,
    renewed: `Subscription Renewed: ${organizationName}`,
    payment_failed: `Payment Failed: ${organizationName}`,
  };

  const templateMap = {
    created: 'subscription-created',
    cancelled: 'subscription-cancelled',
    renewed: 'subscription-renewed',
    payment_failed: 'payment-failed',
  };

  try {
    await sendEmail({
      to: adminEmail,
      subject: subjectMap[event],
      template: templateMap[event],
      data: {
        organizationName,
        organizationId,
        planType: planType === 'unlimited' ? 'Unlimited Plan' : 'Custom Plan',
        date: new Date().toISOString(),
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/organization-billing`,
      },
    });

    // Also send a copy to the platform admin
    if (process.env.ADMIN_EMAIL) {
      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `[Admin] ${subjectMap[event]}`,
        template: `admin-${templateMap[event]}`,
        data: {
          organizationName,
          organizationId,
          planType: planType === 'unlimited' ? 'Unlimited Plan' : 'Custom Plan',
          date: new Date().toISOString(),
          adminDashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/organizations/${organizationId}`,
        },
      });
    }
  } catch (error) {
    console.error('Failed to send subscription notification email:', error);
    // Don't throw error to avoid breaking the main flow
  }
}

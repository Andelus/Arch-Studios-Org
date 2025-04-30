import { Suspense } from 'react';
import { getSubscriptionPlans } from './SubscriptionPlans';
import CreditSubscriptionClient from './CreditSubscriptionClient';

export default async function CreditSubscription() {
  const plans = await getSubscriptionPlans();
  
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreditSubscriptionClient initialPlans={plans} />
    </Suspense>
  );
}
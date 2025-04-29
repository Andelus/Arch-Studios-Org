import { getSubscriptionPlans } from './SubscriptionPlans';
import CreditSubscriptionClient from './CreditSubscriptionClient';

export default async function CreditSubscription() {
  const plans = await getSubscriptionPlans();
  
  return <CreditSubscriptionClient initialPlans={plans} />;
} 
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import AssetsClient from './AssetsClient';

export default async function AssetsPage() {
  // Protect this page - only logged in users can access
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }
  
  return (
    <>
      <AssetsClient userId={userId} />
    </>
  );
}
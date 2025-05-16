import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import AssetsClientSection from './AssetsClientSection';

export const metadata = {
  title: 'Asset History | Arch Studios',
  description: 'View your generated images and 3D models',
};

export default async function AssetsPage() {
  // Server-side auth check
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <div>
      <AssetsClientSection />
    </div>
  );
}

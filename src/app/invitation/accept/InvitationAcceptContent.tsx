"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { validateInvitation, acceptInvitation } from '@/lib/invitation-service';
import Link from 'next/link';

interface InvitationDetails {
  project_id: string;
  email: string;
  role: string;
  permission: string;
}

export default function InvitationAcceptContent() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Check the invitation token when the component loads
  useEffect(() => {
    async function checkInvitation() {
      if (!token) {
        setError('Invalid invitation link. No token provided.');
        setLoading(false);
        return;
      }
      
      try {
        const invitationData = await validateInvitation(token);
        
        if (!invitationData) {
          setError('This invitation is invalid or has expired.');
          setLoading(false);
          return;
        }
        
        setInvitation({
          project_id: invitationData.project_id,
          email: invitationData.email,
          role: invitationData.role,
          permission: invitationData.permission,
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Failed to validate invitation:', error);
        setError('Unable to validate invitation. Please try again.');
        setLoading(false);
      }
    }
    
    if (isLoaded) {
      checkInvitation();
    }
  }, [token, isLoaded]);
  
  // Auto-accept invitation if signed in and email matches
  useEffect(() => {
    async function autoAccept() {
      if (!isSignedIn || !user || !invitation) {
        return;
      }
      
      // Check if any of user's email addresses match the invitation
      const userEmails = user.emailAddresses.map(e => e.emailAddress.toLowerCase());
      const invitationEmail = invitation.email.toLowerCase();
      
      if (!userEmails.includes(invitationEmail)) {
        setError(`This invitation was sent to ${invitation.email}. Please sign in with that email address to accept it.`);
        return;
      }
      
      try {
        const accepted = await acceptInvitation(token!, user.id);
        
        if (accepted) {
          setSuccess(true);
          // Redirect to project after a short delay
          setTimeout(() => {
            router.push(`/workspace?project=${invitation.project_id}`);
          }, 3000);
        } else {
          setError('Failed to accept the invitation. Please try again.');
        }
      } catch (error) {
        console.error('Failed to accept invitation:', error);
        setError('An error occurred while accepting the invitation.');
      }
    }
    
    if (isLoaded && isSignedIn && invitation) {
      autoAccept();
    }
  }, [isLoaded, isSignedIn, user, invitation, token, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full">
          <div className="flex justify-center mb-6">
            <img src="/logo.svg" alt="Arch Studios Logo" className="h-12" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-6">Validating Invitation...</h1>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full">
          <div className="flex justify-center mb-6">
            <img src="/logo.svg" alt="Arch Studios Logo" className="h-12" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-4">Invitation Error</h1>
          <p className="text-red-500 text-center mb-6">{error}</p>
          <div className="flex justify-center">
            <Link 
              href="/dashboard" 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full">
          <div className="flex justify-center mb-6">
            <img src="/logo.svg" alt="Arch Studios Logo" className="h-12" />
          </div>
          <div className="flex justify-center mb-6 text-green-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-center mb-4">Invitation Accepted!</h1>
          <p className="text-gray-600 text-center mb-6">
            You've successfully joined the project. Redirecting you to the workspace...
          </p>
        </div>
      </div>
    );
  }
  
  // Display invitation details and sign in/up options if not automatically accepted
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full">
        <div className="flex justify-center mb-6">
          <img src="/logo.svg" alt="Arch Studios Logo" className="h-12" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-4">Join the Project</h1>
        
        {invitation && (
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              You've been invited to join a project as a <span className="font-semibold">{invitation.role}</span>.
            </p>
            <div className="bg-gray-50 p-4 rounded mb-6">
              <div className="mb-2">
                <span className="text-gray-500 text-sm">Email:</span>
                <p className="font-medium">{invitation.email}</p>
              </div>
              <div className="mb-2">
                <span className="text-gray-500 text-sm">Role:</span>
                <p className="font-medium">{invitation.role}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Permission Level:</span>
                <p className="font-medium capitalize">{invitation.permission}</p>
              </div>
            </div>
          </div>
        )}
        
        {!isSignedIn ? (
          <div>
            <p className="text-gray-600 mb-4 text-center">
              Please sign in or create an account to accept this invitation:
            </p>
            <div className="flex flex-col space-y-3">
              <Link 
                href={`/sign-in?redirect_url=${encodeURIComponent(`/invitation/accept?token=${token}`)}`}
                className="px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700 transition-colors"
              >
                Sign In
              </Link>
              <Link 
                href={`/sign-up?redirect_url=${encodeURIComponent(`/invitation/accept?token=${token}`)}`}
                className="px-4 py-2 border border-blue-600 text-blue-600 text-center rounded hover:bg-blue-50 transition-colors"
              >
                Create Account
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Processing your invitation...</p>
          </div>
        )}
      </div>
    </div>
  );
}

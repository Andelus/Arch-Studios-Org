import { useEffect, useState } from 'react';

interface CreditDisplayProps {
  onCreditUpdate?: (credits: number) => void;
}

export default function CreditDisplay({ onCreditUpdate }: CreditDisplayProps) {
  const [credits, setCredits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCredits = async () => {
    try {
      const response = await fetch('/api/profile');
      if (response.ok) {
        const data = await response.json();
        setCredits(data.credits_balance || 0);
        onCreditUpdate?.(data.credits_balance || 0);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-blue-500/5 dark:from-blue-400/20 dark:to-blue-400/10 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium border border-blue-500/20 dark:border-blue-400/20">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="opacity-70"
      >
        <path d="M10 2L3 14h9l-1 8 8-12h-9l1-8z" />
      </svg>
      <span className="font-medium tracking-tight">{credits} Credits</span>
    </div>
  );
}
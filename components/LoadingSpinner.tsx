
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', text }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-12 h-12 border-4',
    lg: 'w-24 h-24 border-8',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div
        className={`${sizeClasses[size]} border-blue-400 border-t-transparent rounded-full animate-spin`}
      ></div>
      {text && <p className="text-lg text-gray-300">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;

import React from 'react';

export default function Spinner({ size = 'md', className = '', label = 'Loading...' }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  return (
    <div className={`flex flex-col items-center justify-center p-4 ${className}`} role="status">
      <div className={`animate-spin rounded-full border-slate-200 border-t-indigo-600 ${sizes[size] || sizes.md}`} />
      {label && <span className="text-xs text-slate-500 mt-2 font-medium">{label}</span>}
    </div>
  );
}

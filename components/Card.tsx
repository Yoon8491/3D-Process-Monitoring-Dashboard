import { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ title, children, className = '', onClick }: CardProps) {
  return (
    <div 
      className={`bg-white rounded-lg border border-slate-200 p-6 shadow-sm ${className}`}
      onClick={onClick}
    >
      {title && (
        <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
}

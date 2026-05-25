import { useState } from 'react';

interface StudentAvatarProps {
  photoURL?: string;
  studentId: string;
  name: string;
  gender?: 'male' | 'female';
  className?: string;
}

export default function StudentAvatar({ 
  photoURL, 
  studentId, 
  name, 
  gender, 
  className = "w-10 h-10 rounded-xl"
}: StudentAvatarProps) {
  const [error, setError] = useState(false);
  
  // Use studentId as seed for Dicebear to keep it consistent
  const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentId}`;
  
  if (photoURL && !error) {
    return (
      <div className={`${className} overflow-hidden bg-slate-100 border border-slate-200/50`}>
        <img 
          src={photoURL} 
          alt={name} 
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  // Fallback to Dicebear
  return (
    <div className={`${className} overflow-hidden bg-slate-100 border border-white shadow-inner flex items-center justify-center`}
      style={{
        background: gender === 'male'
          ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
          : gender === 'female'
          ? 'linear-gradient(135deg, #ec4899, #f43f5e)'
          : 'linear-gradient(135deg, #94a3b8, #64748b)'
      }}
    >
      <img 
        src={dicebearUrl} 
        alt={name} 
        className="w-[90%] h-[90%] object-cover opacity-90 drop-shadow-md"
      />
    </div>
  );
}

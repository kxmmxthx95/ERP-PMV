// src/App.tsx
import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authService } from '@/features/auth/authService';
import { useAuthStore } from '@/store/authStore';
import { AppRouter } from '@/router/AppRouter';

const queryClient = new QueryClient();

function App() {
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    // เริ่มต้นระบบติดตามสถานะการ Login และ Role
    const unsubscribe = authService.listenToAuthChanges();
    return () => unsubscribe(); 
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {isLoading ? (
        <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center gap-4 text-white font-sans">
          <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
          <p className="text-slate-400 animate-pulse text-sm tracking-widest uppercase">Piyamit System Loading...</p>
        </div>
      ) : (
        <div className="min-h-screen bg-[#0f172a] font-sans antialiased selection:bg-sky-500/30">
          <BrowserRouter>
            <Toaster
              theme="dark"
              position="top-center"
              expand={false}
              richColors
              closeButton
              toastOptions={{
                style: {
                  background: 'rgba(30, 41, 59, 0.7)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }
              }}
            />
            <AppRouter />
          </BrowserRouter>
        </div>
      )}
    </QueryClientProvider>
  );
}

export default App;
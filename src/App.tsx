import { HashRouter as Router } from 'react-router-dom';
import { Toaster } from 'sonner';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, getDefaultAdminSettings } from './providers/AuthProvider';
import { PlanProvider } from './providers/PlanProvider';
import { AppLayout } from './layout/AppLayout';
import { AnimatedRoutes } from './app/routes';

export { getDefaultAdminSettings };

export default function App() {
  const paypalOptions = {
    clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "test",
    currency: "USD",
    intent: "capture"
  };

  return (
    <ErrorBoundary>
      <PayPalScriptProvider options={paypalOptions}>
        <Toaster position="bottom-right" richColors />
        <ThemeProvider>
          <AuthProvider>
            <PlanProvider>
              <Router>
                <AppLayout>
                  <AnimatedRoutes />
                </AppLayout>
              </Router>
            </PlanProvider>
          </AuthProvider>
        </ThemeProvider>
      </PayPalScriptProvider>
    </ErrorBoundary>
  );
}


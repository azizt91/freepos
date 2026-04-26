import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { checkVersion } from "@/lib/version-check";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useState } from 'react';
import LockScreen from "./components/LockScreen";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Cashier from "./pages/Cashier";
import Products from "./pages/Products";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import SupplierPage from "./pages/Supplier";
import StockInPage from "./pages/StockIn";
import StockOutPage from "./pages/StockOut";
import TransactionHistory from "./pages/TransactionHistory";
import StockReport from "./pages/StockReport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [isUnlocked, setIsUnlocked] = useState(() => sessionStorage.getItem('unlocked') === 'true');
  const settings = useLiveQuery(() => db.storeSettings.toCollection().first());

  useEffect(() => {
    checkVersion();
  }, []);

  const handleUnlock = () => {
    setIsUnlocked(true);
    sessionStorage.setItem('unlocked', 'true');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {settings?.pin && !isUnlocked ? (
            <LockScreen onUnlock={handleUnlock} />
          ) : (
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/cashier" element={<Cashier />} />
                <Route path="/products" element={<Products />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/supplier" element={<SupplierPage />} />
                <Route path="/stock-in" element={<StockInPage />} />
                <Route path="/stock-out" element={<StockOutPage />} />
                <Route path="/history" element={<TransactionHistory />} />
                <Route path="/stock-report" element={<StockReport />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

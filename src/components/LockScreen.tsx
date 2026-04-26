import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Lock, Unlock, Delete, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface LockScreenProps {
  onUnlock: () => void;
}

export default function LockScreen({ onUnlock }: LockScreenProps) {
  const [pin, setPin] = useState('');
  const settings = useLiveQuery(() => db.storeSettings.toCollection().first());

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === settings?.pin) {
        onUnlock();
      } else {
        toast.error('PIN Salah, silakan coba lagi');
        setPin('');
      }
    }
  }, [pin, settings, onUnlock]);

  if (!settings?.pin) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="w-full max-w-xs flex flex-col items-center gap-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{settings.storeName}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <UserCircle2 className="w-4 h-4" />
            Masukkan PIN Keamanan
          </p>
        </div>

        {/* PIN Dots */}
        <div className="flex gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                pin.length > i 
                  ? 'bg-primary border-primary scale-110' 
                  : 'bg-transparent border-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <Button
              key={num}
              variant="outline"
              className="h-16 text-2xl font-semibold rounded-2xl border-primary/10 hover:bg-primary/5 active:scale-95 transition-transform"
              onClick={() => handleKeyPress(num.toString())}
            >
              {num}
            </Button>
          ))}
          <div /> {/* Empty space */}
          <Button
            variant="outline"
            className="h-16 text-2xl font-semibold rounded-2xl border-primary/10 hover:bg-primary/5 active:scale-95 transition-transform"
            onClick={() => handleKeyPress('0')}
          >
            0
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-16 rounded-2xl hover:bg-destructive/10 text-destructive active:scale-95 transition-transform"
            onClick={handleDelete}
          >
            <Delete className="w-6 h-6" />
          </Button>
        </div>
        
        <p className="text-[10px] text-muted-foreground mt-4 italic">
          Data bapak 100% aman di dalam HP ini.
        </p>
      </div>
    </div>
  );
}

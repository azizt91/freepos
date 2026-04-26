import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, CameraOff, Flashlight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export default function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scannerId = 'barcode-scanner';

  useEffect(() => {
    if (!open) return;

    const startScanner = async () => {
      try {
        const container = document.getElementById(scannerId);
        if (!container) return;

        // Clean up any existing instance
        if (scannerRef.current) {
          try { await scannerRef.current.stop(); } catch(e) {}
          scannerRef.current = null;
        }

        const scanner = new Html5Qrcode(scannerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.QR_CODE
          ],
          verbose: false,
        });

        scannerRef.current = scanner;
        setScanning(true);

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        };

        const playBeep = () => {
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 1000;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;
            oscillator.start();
            setTimeout(() => oscillator.stop(), 100);
          } catch (e) {}
        };

        const onScanSuccess = (decodedText: string) => {
          playBeep();
          onScan(decodedText);
          handleClose();
        };

        // Try environment camera
        await scanner.start(
          { facingMode: "environment" },
          config,
          onScanSuccess,
          () => {}
        ).catch(async (err) => {
          console.warn("Back camera failed, trying front...", err);
          return await scanner.start(
            { facingMode: "user" },
            config,
            onScanSuccess,
            () => {}
          );
        });

        const track = scanner.getRunningTrackCameraCapabilities();
        if (track && 'torchFeature' in track) {
          setHasFlash(true);
        }
      } catch (err: unknown) {
        console.error('Scanner error:', err);
        const errorMessage = String(err);
        if (errorMessage.includes('NotAllowedError')) {
          toast.error('Mohon izinkan akses kamera di browser bapak.');
        } else {
          toast.error('Gagal membuka kamera. Coba segarkan halaman.');
        }
        onClose();
      }
    };

    // Use 300ms as a compromise - enough for Dialog but still fast
    const timer = setTimeout(() => {
      if (open) startScanner();
    }, 300);

    return () => {
      clearTimeout(timer);
      handleStop();
    };
  }, [open]);

  const handleStop = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (e) {
        console.warn("Stop error", e);
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const toggleFlash = async () => {
    if (!scannerRef.current) return;
    try {
      const track = scannerRef.current.getRunningTrackCameraCapabilities();
      if (track && 'torchFeature' in track) {
        const torch = (track as unknown as { torchFeature: () => { apply: (on: boolean) => Promise<void> } }).torchFeature();
        await torch.apply(!flashOn);
        setFlashOn(!flashOn);
      }
    } catch {
      toast.error('Flash tidak didukung di perangkat ini');
    }
  };

  const handleClose = async () => {
    await handleStop();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => v || handleClose()}>
      <DialogContent className="max-w-[95vw] rounded-xl p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Scan Barcode
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          {/* Removed bg-black and aspect-ratio to see if it affects rendering */}
          <div id={scannerId} className="w-full min-h-[300px] bg-muted rounded-lg" />

          <div className="absolute top-3 right-3 flex gap-2">
            {hasFlash && (
              <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg"
                onClick={toggleFlash}
              >
                <Flashlight className={`w-5 h-5 ${flashOn ? 'text-yellow-400' : ''}`} />
              </Button>
            )}
          </div>

          <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
              <p className="text-white text-xs text-center">
                Arahkan barcode ke dalam kotak scan
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 pt-2">
          <Button variant="outline" className="w-full" onClick={handleClose}>
            <CameraOff className="w-4 h-4 mr-2" />
            Batal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

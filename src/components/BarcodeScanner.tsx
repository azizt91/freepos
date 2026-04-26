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
        // Ensure container exists
        const container = document.getElementById(scannerId);
        if (!container) return;

        const scanner = new Html5Qrcode(scannerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });

        scannerRef.current = scanner;
        setScanning(true);

        // Dynamic qrbox based on container size
        const qrBoxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdgePercentage = 0.7; // 70%
          const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
          return {
            width: qrboxSize,
            height: Math.floor(qrboxSize * 0.6) // Rectangular for barcodes
          };
        };

        const config = {
          fps: 15,
          qrbox: qrBoxFunction,
          aspectRatio: 1.333333, // 4:3
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: false, // We use our own
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
          } catch (e) {
            console.log('Audio not supported', e);
          }
        };

        const onScanSuccess = (decodedText: string) => {
          playBeep();
          onScan(decodedText);
          handleStop();
        };

        try {
          // Try environment (back) camera first
          await scanner.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            () => {} // silent on scan failure
          );
        } catch (err) {
          console.warn('Back camera failed, trying any available camera...', err);
          try {
            // Fallback: Try to get any camera
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              const cameraId = devices[devices.length - 1].id; // Usually back camera is last
              await scanner.start(cameraId, config, onScanSuccess, () => {});
            } else {
              // Last resort: facingMode user
              await scanner.start({ facingMode: "user" }, config, onScanSuccess, () => {});
            }
          } catch (fallbackErr) {
            throw fallbackErr;
          }
        }

        const track = scanner.getRunningTrackCameraCapabilities();
        if (track && 'torchFeature' in track) {
          setHasFlash(true);
        }
      } catch (err: unknown) {
        console.error('Scanner error:', err);
        const errorMessage = err instanceof Error ? err.toString() : String(err);
        if (errorMessage.includes('NotAllowedError')) {
          toast.error('Izin kamera ditolak. Mohon izinkan akses kamera di pengaturan browser.');
        } else if (errorMessage.includes('NotFoundError')) {
          toast.error('Kamera tidak ditemukan.');
        } else {
          toast.error('Gagal memulai kamera. Coba segarkan halaman atau pastikan izin kamera aktif.');
        }
        onClose();
      }
    };

    // CR-11: Increased delay to 600ms to ensure Dialog transition is complete
    const timer = setTimeout(() => {
      startScanner();
    }, 600);

    return () => {
      clearTimeout(timer);
      handleStop();
    };
  }, [open]);

  const handleStop = async () => {
    if (scannerRef.current && scanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch {
        // Ignore errors when stopping scanner
      }
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
          <div id={scannerId} className="w-full aspect-[4/3] bg-black rounded-lg" />

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

          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
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

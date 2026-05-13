/**
 * Web-only barcode scanner using the browser's native BarcodeDetector API
 * (Chrome / Edge / Android Chrome). Zero JS dependencies.
 *
 * If BarcodeDetector isn't available (Safari iOS, Firefox), `supported` is
 * false and the caller should hide the scan button + fall back to manual
 * barcode entry.
 *
 * Component lifecycle:
 *   - Mount: request rear camera via getUserMedia, attach to <video>,
 *     start polling BarcodeDetector at 4 Hz.
 *   - On detect: fire onScan(code), then stop polling (caller closes).
 *   - On error: fire onError(message), stop polling.
 *   - Unmount: stop the MediaStream tracks (release the camera).
 *
 * Renders nothing on native (Platform.OS !== 'web'). Bare html elements
 * to avoid pulling react-native-web's <View> camera-styling quirks.
 */

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): {
    detect(source: HTMLVideoElement | HTMLCanvasElement): Promise<DetectedBarcode[]>;
  };
  getSupportedFormats?: () => Promise<string[]>;
}

export function isBarcodeDetectorSupported(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

interface Props {
  onScan: (code: string) => void;
  onError: (message: string) => void;
  /** Stop polling externally (e.g. on close). */
  paused?: boolean;
}

export function BarcodeScannerWeb({ onScan, onError, paused }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<InstanceType<BarcodeDetectorCtor> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef = useRef(false);
  const [status, setStatus] = useState<string>('Initialising camera…');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isBarcodeDetectorSupported()) {
      onError('This browser doesn\'t support camera barcode scanning. Type the digits manually below.');
      return;
    }

    let cancelled = false;
    const start = async () => {
      try {
        const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
        detectorRef.current = new Detector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus('Point at a barcode…');

        pollRef.current = setInterval(async () => {
          if (firedRef.current || paused) return;
          const det = detectorRef.current;
          if (!det || !videoRef.current) return;
          try {
            const codes = await det.detect(videoRef.current);
            if (codes.length > 0 && codes[0]!.rawValue) {
              firedRef.current = true;
              onScan(codes[0]!.rawValue.replace(/[^\d]/g, ''));
            }
          } catch {
            // Transient frame failures are normal; keep polling.
          }
        }, 250);
      } catch (e) {
        const msg =
          e instanceof Error && /denied/i.test(e.message)
            ? 'Camera permission denied. Allow camera access and try again.'
            : e instanceof Error && /not allowed|secure/i.test(e.message)
              ? 'Camera requires HTTPS. Try the deployed URL, not localhost.'
              : 'Could not access camera.';
        onError(msg);
      }
    };

    start();

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      detectorRef.current = null;
    };
  }, [onScan, onError, paused]);

  if (Platform.OS !== 'web') return null;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 10',
        background: '#000',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      {/* viewfinder hint */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          bottom: '30%',
          left: '10%',
          right: '10%',
          border: '2px solid rgba(255,255,255,0.8)',
          borderRadius: 8,
          pointerEvents: 'none',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: '#fff',
          fontSize: 12,
          textShadow: '0 1px 4px rgba(0,0,0,0.7)',
        }}
      >
        {status}
      </div>
    </div>
  );
}

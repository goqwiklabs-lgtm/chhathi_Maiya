import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';

import bg1 from '../assets/images/1.webp';
import bg2 from '../assets/images/2.webp';
import bg3 from '../assets/images/3.webp';

const IMAGES = [bg1, bg2, bg3];

// Helper to get random duration between 20 seconds and 120 seconds (2 minutes)
const getRandomDurationSeconds = () => {
  return Math.floor(Math.random() * (120 - 20 + 1)) + 20;
};

interface BackgroundSlideshowProps {
  isMotionEnabled?: boolean;
}

export const BackgroundSlideshow: React.FC<BackgroundSlideshowProps> = ({
  isMotionEnabled = true
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cycleKey, setCycleKey] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(getRandomDurationSeconds);

  // Motion values for inverted tactile parallax, tilt, mouse hover & shake
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  // Responsive spring physics with natural bounce and settling
  const springX = useSpring(rawX, { stiffness: 200, damping: 22 });
  const springY = useSpring(rawY, { stiffness: 200, damping: 22 });

  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  // When motion is turned off in settings, immediately reset coordinates to center
  useEffect(() => {
    if (!isMotionEnabled) {
      rawX.set(0);
      rawY.set(0);
    }
  }, [isMotionEnabled, rawX, rawY]);

  // Eagerly preload all background images in browser memory
  useEffect(() => {
    IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Schedule random background image transitions between 20s and 2 minutes (120s)
  // This continues running regardless of whether shake/motion is enabled or disabled
  useEffect(() => {
    let timerId: NodeJS.Timeout;

    const schedule = (delaySec: number) => {
      timerId = setTimeout(() => {
        const nextDuration = getRandomDurationSeconds();

        // Pick a different random image
        setCurrentIndex((prev) => {
          let next = Math.floor(Math.random() * IMAGES.length);
          while (next === prev && IMAGES.length > 1) {
            next = Math.floor(Math.random() * IMAGES.length);
          }
          return next;
        });

        setCurrentDuration(nextDuration);
        setCycleKey((c) => c + 1);

        schedule(nextDuration);
      }, delaySec * 1000);
    };

    schedule(currentDuration);

    return () => {
      clearTimeout(timerId);
    };
  }, []);

  // 1. PC / Desktop Mouse Hover Parallax: moving mouse right moves image left, etc.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isMotionEnabled || isDraggingRef.current) return;
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      const normX = Math.max(-1, Math.min(1, (e.clientX - halfW) / halfW));
      const normY = Math.max(-1, Math.min(1, (e.clientY - halfH) / halfH));

      // Subtle inverted displacement: moving right moves image left
      const maxOffset = 30;
      rawX.set(-normX * maxOffset);
      rawY.set(-normY * maxOffset);
    };

    const handleMouseLeave = () => {
      if (isDraggingRef.current) return;
      rawX.set(0);
      rawY.set(0);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isMotionEnabled, rawX, rawY]);

  // 2. Mobile Gyroscope / Tilt Parallax (deviceorientation)
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!isMotionEnabled || isDraggingRef.current) return;
      const gamma = e.gamma || 0; // -90 to 90 (left/right tilt)
      const beta = e.beta || 0;   // -180 to 180 (front/back tilt)

      // Normalize angles around natural ~45deg holding position
      const clampedGamma = Math.max(-30, Math.min(30, gamma));
      const clampedBeta = Math.max(-30, Math.min(30, beta - 45));

      const maxOffset = 32;
      const targetX = -(clampedGamma / 30) * maxOffset;
      const targetY = -(clampedBeta / 30) * maxOffset;

      rawX.set(targetX);
      rawY.set(targetY);
    };

    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [isMotionEnabled, rawX, rawY]);

  // 3. Mobile Device Shake & Move Detection (devicemotion)
  useEffect(() => {
    let lastX = 0;
    let lastY = 0;
    let lastZ = 0;
    let lastShakeTime = 0;

    const handleMotion = (e: DeviceMotionEvent) => {
      if (!isMotionEnabled) return;

      const acc = e.accelerationIncludingGravity || e.acceleration;
      if (!acc) return;

      const curX = acc.x || 0;
      const curY = acc.y || 0;
      const curZ = acc.z || 0;

      const delta = Math.abs(curX - lastX) + Math.abs(curY - lastY) + Math.abs(curZ - lastZ);
      lastX = curX;
      lastY = curY;
      lastZ = curZ;

      const now = Date.now();
      // Threshold for device shake / vigorous movement
      if (delta > 18 && now - lastShakeTime > 350) {
        lastShakeTime = now;
        // Trigger a springy wobble/shake impulse
        const dirX = Math.random() > 0.5 ? 1 : -1;
        const dirY = Math.random() > 0.5 ? 1 : -1;
        rawX.set(dirX * (22 + Math.random() * 12));
        rawY.set(dirY * (20 + Math.random() * 12));

        // Rebound impulse to settle naturally through the spring
        setTimeout(() => {
          rawX.set(-dirX * 10);
          rawY.set(-dirY * 10);
          setTimeout(() => {
            rawX.set(0);
            rawY.set(0);
          }, 80);
        }, 70);
      }
    };

    // Request permissions for iOS 13+ devices on first touch/click
    const requestPermissionOnFirstTouch = () => {
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
        (DeviceOrientationEvent as any).requestPermission().catch(() => {});
      }
      if (
        typeof DeviceMotionEvent !== 'undefined' &&
        typeof (DeviceMotionEvent as any).requestPermission === 'function'
      ) {
        (DeviceMotionEvent as any).requestPermission().catch(() => {});
      }
      window.removeEventListener('click', requestPermissionOnFirstTouch);
      window.removeEventListener('touchstart', requestPermissionOnFirstTouch);
    };

    window.addEventListener('click', requestPermissionOnFirstTouch, { once: true });
    window.addEventListener('touchstart', requestPermissionOnFirstTouch, { once: true });
    window.addEventListener('devicemotion', handleMotion, { passive: true });

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      window.removeEventListener('click', requestPermissionOnFirstTouch);
      window.removeEventListener('touchstart', requestPermissionOnFirstTouch);
    };
  }, [isMotionEnabled, rawX, rawY]);

  // 4. Mobile Direct Touch Drag Parallax
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMotionEnabled) return;
    isDraggingRef.current = true;
    startPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMotionEnabled || !isDraggingRef.current) return;

    const deltaX = e.clientX - startPosRef.current.x;
    const deltaY = e.clientY - startPosRef.current.y;

    const maxOffset = 36;
    const factor = 0.24;

    const targetX = Math.max(-maxOffset, Math.min(maxOffset, -deltaX * factor));
    const targetY = Math.max(-maxOffset, Math.min(maxOffset, -deltaY * factor));

    rawX.set(targetX);
    rawY.set(targetY);
  };

  const handlePointerUpOrCancel = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <div
      className={`fixed inset-0 z-0 overflow-hidden bg-black select-none ${
        isMotionEnabled ? 'pointer-events-auto touch-none' : 'pointer-events-none'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onPointerLeave={handlePointerUpOrCancel}
    >
      {/* 
        Tactile Parallax & Shake Wrapper:
        - Inset by -10 so shifting/shaking by +/-36px never reveals background borders
        - Connected to smooth spring physics (mouse hover, phone tilt, shake, touch drag)
      */}
      <motion.div
        className="absolute -inset-10 overflow-hidden pointer-events-none"
        style={{
          x: springX,
          y: springY,
        }}
      >
        {/* 
          Crossfading layers:
          - Initial image is displayed immediately without initial black flash (initial={false})
          - Subsequent transitions smoothly fade with blur in/out over 1.8s
          - In the remaining duration (up to 2 minutes), slow subtle Ken Burns zoom into center
          - REMAINS 100% ACTIVE even when motion/shake is disabled!
        */}
        <AnimatePresence initial={false}>
          <motion.div
            key={`${currentIndex}-${cycleKey}`}
            className="absolute inset-0 overflow-hidden pointer-events-none"
            initial={{ opacity: 0, filter: 'blur(14px)', scale: 1.0 }}
            animate={{ opacity: 1, filter: 'blur(0px)', scale: 1.045 }}
            exit={{
              opacity: 0,
              filter: 'blur(14px)',
              transition: { duration: 1.8, ease: 'easeInOut' },
            }}
            transition={{
              opacity: { duration: 1.8, ease: 'easeInOut' },
              filter: { duration: 1.8, ease: 'easeInOut' },
              scale: { duration: currentDuration, ease: 'linear' },
            }}
            style={{ transformOrigin: 'center center' }}
          >
            <img
              src={IMAGES[currentIndex]}
              alt={`Chhath Puja Artwork ${currentIndex + 1}`}
              className="w-full h-full object-cover object-center min-h-[calc(100dvh+5rem)] min-w-[calc(100vw+5rem)] pointer-events-none"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Atmospheric lighting & contrast vignette */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.5)_100%)]" />
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Image } from 'lucide-react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  className?: string;
  wrapperClassName?: string;
}

export default function LazyImage({
  src,
  alt = 'Gear image',
  fallbackSrc = 'https://picsum.photos/seed/gear/400/400',
  className = '',
  wrapperClassName = '',
  ...props
}: LazyImageProps) {
  const [isIntersected, setIsIntersected] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const imageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsIntersected(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersected(true);
          if (imageRef.current) {
            observer.unobserve(imageRef.current);
          }
        }
      },
      {
        rootMargin: '150px 0px', // Start loading 150px before entering viewport
        threshold: 0.01,
      }
    );

    const currentRef = imageRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    if (props.onLoad) {
      props.onLoad(e);
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsError(true);
    if (props.onError) {
      props.onError(e);
    }
  };

  const finalSrc = isError ? fallbackSrc : (src || fallbackSrc);

  return (
    <div
      ref={imageRef}
      className={`relative overflow-hidden ${wrapperClassName}`}
      style={{ display: 'inline-block', width: '100%', height: '100%' }}
    >
      {/* Real Image */}
      {isIntersected && (
        <img
          src={finalSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={`${className} transition-opacity duration-500 ease-out ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          referrerPolicy="no-referrer"
          {...props}
        />
      )}

      {/* Pulsing/Shimmer Loading Placeholder */}
      {(!isIntersected || !isLoaded) && (
        <div className="absolute inset-0 bg-neutral-100 dark:bg-neutral-800 animate-pulse flex items-center justify-center">
          <Image className="w-5 h-5 text-neutral-300 dark:text-neutral-650" />
        </div>
      )}
    </div>
  );
}

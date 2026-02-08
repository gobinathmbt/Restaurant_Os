/**
 * Proxied Image Component
 * Automatically handles S3 private bucket images through backend proxy
 */

import React, { useState } from 'react';
import { getProxiedImageUrl, handleImageError } from '@/utils/imageUtils';

interface ProxiedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | null | undefined;
  fallback?: string;
  alt: string;
}

/**
 * Image component that automatically proxies S3 URLs through backend
 * Includes error handling and fallback support
 */
export const ProxiedImage: React.FC<ProxiedImageProps> = ({
  src,
  fallback = '/placeholder.svg',
  alt,
  className,
  ...props
}) => {
  const [imgSrc, setImgSrc] = useState<string>(
    src ? getProxiedImageUrl(src) : fallback
  );
  const [hasError, setHasError] = useState(false);

  const handleError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(fallback);
      handleImageError(event, fallback);
    }
  };

  // Update image source when src prop changes
  React.useEffect(() => {
    if (src) {
      setImgSrc(getProxiedImageUrl(src));
      setHasError(false);
    } else {
      setImgSrc(fallback);
    }
  }, [src, fallback]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      {...props}
    />
  );
};

export default ProxiedImage;

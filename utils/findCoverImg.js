function findCoverImage(article) {
  // Return null if no article provided
  if (!article) return null;

  // Helper function to validate URL
  function isValidUrl(url) {
    if (!url || !url.trim()) return false;
    try {
      new URL(url, window.location.href);
      return true;
    } catch {
      return false;
    }
  }

  // Helper function to extract URL from CSS background-image
  function extractBgImageUrl(bgImage) {
    if (!bgImage || bgImage === 'none') return null;
    const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
    return match ? match[1] : null;
  }

  // Strategy 1: Check Open Graph meta tag (most reliable for cover images)
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage && isValidUrl(ogImage.content)) {
    return ogImage.content;
  }

  // Strategy 2: Check Twitter Card meta tag
  const twitterImage = document.querySelector('meta[name="twitter:image"]');
  if (twitterImage && isValidUrl(twitterImage.content)) {
    return twitterImage.content;
  }

  // Strategy 3: Check Schema.org structured data
  const ldJsonScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of ldJsonScripts) {
    try {
      const data = JSON.parse(script.textContent);
      if (data.image) {
        const imageUrl = typeof data.image === 'string' ? data.image : data.image.url;
        if (isValidUrl(imageUrl)) {
          return imageUrl;
        }
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  // Strategy 4: Look in article header for figure > img
  const headerImg = article.querySelector('header figure img[src], header img[src]');
  if (headerImg && isValidUrl(headerImg.src)) {
    return headerImg.src;
  }

  // Strategy 5: Look for img with common cover/hero class names
  const commonClassSelectors = [
    'img.cover-image',
    'img.hero-image',
    'img.featured-image',
    'img.banner-image',
    'img[class*="cover"]',
    'img[class*="hero"]',
    'img[class*="featured"]',
    'img[class*="banner"]',
    'img[class*="image"]'
  ];

  for (const selector of commonClassSelectors) {
    const img = article.querySelector(selector);
    if (img && isValidUrl(img.src)) {
      return img.src;
    }
  }

  // Strategy 6: Look for img in common container class names
  const commonContainerSelectors = [
    '.cover img',
    '.hero img',
    '.featured-image img',
    '.banner img',
    '.article-image img',
    '.post-image img',
    '[class*="cover"] img',
    '[class*="hero"] img'
  ];

  for (const selector of commonContainerSelectors) {
    const img = article.querySelector(selector);
    if (img && isValidUrl(img.src)) {
      return img.src;
    }
  }

  // Strategy 7: First figure > img in article
  const figureImg = article.querySelector('figure img[src]');
  if (figureImg && isValidUrl(figureImg.src)) {
    return figureImg.src;
  }

  // Strategy 8: First img with meaningful size (not icons/avatars)
  const allImages = article.querySelectorAll('img[src]');
  for (const img of allImages) {
    if (isValidUrl(img.src)) {
      // Check if image is reasonably sized (likely a cover, not an icon)
      // Use naturalWidth/Height if available, otherwise width/height
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      
      if (width >= 200 && height >= 200) {
        return img.src;
      }
    }
  }

  // Strategy 9: Just get first valid img if nothing else worked
  const firstImg = article.querySelector('img[src]');
  if (firstImg && isValidUrl(firstImg.src)) {
    return firstImg.src;
  }

  // Strategy 10: Check for CSS background images on common containers
  const bgContainers = article.querySelectorAll(
    'header, .hero, .cover, .banner, .featured-image, [class*="image"], [class*="cover"]'
  );
  
  for (const container of bgContainers) {
    const bgImage = window.getComputedStyle(container).backgroundImage;
    const url = extractBgImageUrl(bgImage);
    if (url && isValidUrl(url)) {
      return url;
    }
  }

  // No cover image found
  return null;
}
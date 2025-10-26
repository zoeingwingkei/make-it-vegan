function findRecipeTitle(articleElement) {
  if (!articleElement || !(articleElement instanceof HTMLElement)) {
    return null;
  }

  // Strategy 1: Look for h1 elements first (most common for titles)
  const h1Elements = articleElement.querySelectorAll('h1');
  if (h1Elements.length === 1) {
    return h1Elements[0].textContent.trim();
  }
  
  // If multiple h1s, try to filter by common title-related attributes
  if (h1Elements.length > 1) {
    for (const h1 of h1Elements) {
      if (hasTitleIndicators(h1)) {
        return h1.textContent.trim();
      }
    }
    // Fall back to first h1 if no clear match
    return h1Elements[0].textContent.trim();
  }

  // Strategy 2: Look for elements with title-indicating class names or IDs
  const titleSelectors = [
    '[class*="title" i]',
    '[class*="heading" i]',
    '[class*="headline" i]',
    '[class*="recipe-name" i]',
    '[class*="recipename" i]',
    '[id*="title" i]',
    '[id*="heading" i]',
    '[id*="headline" i]',
    '[id*="recipe-name" i]',
    '[itemprop="name"]',
    '[property="og:title"]',
    'header h1',
    'header h2'
  ];

  for (const selector of titleSelectors) {
    try {
      const elements = articleElement.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent.trim();
        // Filter out empty strings and very short titles
        if (text && text.length > 2 && isLikelyTitle(element, text)) {
          return text;
        }
      }
    } catch (e) {
      // Skip invalid selectors
      continue;
    }
  }

  // Strategy 3: Look for h2 or h3 as fallback
  const h2Elements = articleElement.querySelectorAll('h2');
  if (h2Elements.length > 0) {
    const firstH2 = h2Elements[0];
    if (hasTitleIndicators(firstH2)) {
      return firstH2.textContent.trim();
    }
  }

  // Strategy 4: Check for schema.org Recipe structured data
  const schemaScript = articleElement.querySelector('script[type="application/ld+json"]');
  if (schemaScript) {
    try {
      const schema = JSON.parse(schemaScript.textContent);
      if (schema.name && (schema['@type'] === 'Recipe' || schema['@type'] === 'recipe')) {
        return schema.name;
      }
      // Handle arrays of structured data
      if (Array.isArray(schema)) {
        const recipe = schema.find(item => item['@type'] === 'Recipe' || item['@type'] === 'recipe');
        if (recipe && recipe.name) {
          return recipe.name;
        }
      }
    } catch (e) {
      // Invalid JSON, continue
    }
  }

  // Strategy 5: Last resort - return first non-empty heading
  const allHeadings = articleElement.querySelectorAll('h1, h2, h3');
  for (const heading of allHeadings) {
    const text = heading.textContent.trim();
    if (text && text.length > 2) {
      return text;
    }
  }

  return null;
}

// Helper function to check if element has title-related indicators
function hasTitleIndicators(element) {
  const className = element.className.toLowerCase();
  const id = element.id.toLowerCase();
  
  const indicators = ['title', 'heading', 'headline', 'recipe-name', 'recipename', 'name'];
  
  return indicators.some(indicator => 
    className.includes(indicator) || id.includes(indicator)
  );
}

// Helper function to determine if text and element are likely a title
function isLikelyTitle(element, text) {
  // Filter out navigation elements, footers, etc.
  const tagName = element.tagName.toLowerCase();
  const parent = element.parentElement;
  
  // Exclude if inside navigation or footer
  if (parent) {
    const parentTag = parent.tagName.toLowerCase();
    if (['nav', 'footer', 'aside'].includes(parentTag)) {
      return false;
    }
  }
  
  // Prefer heading tags
  if (['h1', 'h2', 'h3'].includes(tagName)) {
    return true;
  }
  
  // Filter out very long text (likely not a title)
  if (text.length > 150) {
    return false;
  }
  
  // Check for common title patterns
  const lowerText = text.toLowerCase();
  const titlePatterns = ['recipe', 'how to make', 'easy', 'best', 'homemade'];
  const hasPattern = titlePatterns.some(pattern => lowerText.includes(pattern));
  
  return hasPattern || text.length < 100;
}

// Example usage:
// const article = document.querySelector('article');
// const title = findRecipeTitle(article);
// console.log('Recipe Title:', title);
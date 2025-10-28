function findRecipeMetadata(articleElement) {
  if (!articleElement || !(articleElement instanceof HTMLElement)) {
    return {
      cookTime: null,
      prepTime: null,
      totalTime: null,
      servings: null
    };
  }

  const metadata = {
    cookTime: null,
    prepTime: null,
    totalTime: null,
    servings: null
  };

  // Strategy 1: Look for schema.org Recipe structured data (most reliable)
  const schemaScript = articleElement.querySelector('script[type="application/ld+json"]');
  if (schemaScript) {
    try {
      const schema = JSON.parse(schemaScript.textContent);
      
      // Handle single object
      if (schema['@type'] === 'Recipe' || schema['@type'] === 'recipe') {
        extractFromSchema(schema, metadata);
      }
      
      // Handle arrays of structured data
      if (Array.isArray(schema)) {
        const recipe = schema.find(item => item['@type'] === 'Recipe' || item['@type'] === 'recipe');
        if (recipe) {
          extractFromSchema(recipe, metadata);
        }
      }
      
      // If we found everything from schema, return early
      if (metadata.cookTime && metadata.prepTime && metadata.totalTime && metadata.servings) {
        return metadata;
      }
    } catch (e) {
      // Invalid JSON, continue to other strategies
    }
  }

  // Strategy 2: Look for meta tags with recipe metadata
  if (!metadata.cookTime) {
    const cookTimeMeta = document.querySelector('meta[property="recipe:cook_time"], meta[name="recipe:cook_time"]');
    if (cookTimeMeta) {
      metadata.cookTime = cookTimeMeta.content;
    }
  }
  
  if (!metadata.prepTime) {
    const prepTimeMeta = document.querySelector('meta[property="recipe:prep_time"], meta[name="recipe:prep_time"]');
    if (prepTimeMeta) {
      metadata.prepTime = prepTimeMeta.content;
    }
  }
  
  if (!metadata.totalTime) {
    const totalTimeMeta = document.querySelector('meta[property="recipe:total_time"], meta[name="recipe:total_time"]');
    if (totalTimeMeta) {
      metadata.totalTime = totalTimeMeta.content;
    }
  }

  // Strategy 3: Look for elements with specific attributes
  const timeSelectors = [
    '[itemprop="cookTime"]',
    '[itemprop="prepTime"]',
    '[itemprop="totalTime"]',
    '[class*="cook-time" i]',
    '[class*="cooktime" i]',
    '[class*="prep-time" i]',
    '[class*="preptime" i]',
    '[class*="total-time" i]',
    '[class*="totaltime" i]',
    '[id*="cook-time" i]',
    '[id*="prep-time" i]',
    '[id*="total-time" i]',
    '[data-testid*="cook-time" i]',
    '[data-testid*="prep-time" i]',
    '[data-testid*="total-time" i]'
  ];

  for (const selector of timeSelectors) {
    try {
      const elements = articleElement.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent.trim();
        const attr = (element.getAttribute('itemprop') || 
                     element.getAttribute('data-testid') ||
                     element.className || 
                     element.id).toLowerCase();
        
        if (attr.includes('cook') && !metadata.cookTime) {
          const timeStr = extractTimeString(element);
          if (timeStr) metadata.cookTime = timeStr;
        } else if (attr.includes('prep') && !metadata.prepTime) {
          const timeStr = extractTimeString(element);
          if (timeStr) metadata.prepTime = timeStr;
        } else if (attr.includes('total') && !metadata.totalTime) {
          const timeStr = extractTimeString(element);
          if (timeStr) metadata.totalTime = timeStr;
        }
      }
    } catch (e) {
      continue;
    }
  }

  // Strategy 4: Look for servings/yield
  const servingSelectors = [
    '[itemprop="recipeYield"]',
    '[itemprop="servings"]',
    '[class*="serving" i]',
    '[class*="yield" i]',
    '[id*="serving" i]',
    '[id*="yield" i]',
    '[data-testid*="serving" i]',
    '[data-testid*="yield" i]'
  ];

  for (const selector of servingSelectors) {
    try {
      const elements = articleElement.querySelectorAll(selector);
      for (const element of elements) {
        if (!metadata.servings) {
          metadata.servings = extractServings(element);
          if (metadata.servings) break;
        }
      }
      if (metadata.servings) break;
    } catch (e) {
      continue;
    }
  }

  // Strategy 5: Look for time info in common recipe metadata sections
  if (!metadata.cookTime || !metadata.prepTime || !metadata.totalTime) {
    const metadataSections = articleElement.querySelectorAll(
      '.recipe-meta, .recipe-metadata, .recipe-info, .recipe-details, ' +
      '[class*="recipe-time" i], [class*="time-info" i], [class*="meta" i]'
    );
    
    for (const section of metadataSections) {
      const text = section.textContent.toLowerCase();
      
      if (!metadata.cookTime && (text.includes('cook time') || text.includes('cooking time'))) {
        const timeStr = extractTimeFromText(section.textContent, 'cook');
        if (timeStr) metadata.cookTime = timeStr;
      }
      
      if (!metadata.prepTime && (text.includes('prep time') || text.includes('preparation time'))) {
        const timeStr = extractTimeFromText(section.textContent, 'prep');
        if (timeStr) metadata.prepTime = timeStr;
      }
      
      if (!metadata.totalTime && text.includes('total time')) {
        const timeStr = extractTimeFromText(section.textContent, 'total');
        if (timeStr) metadata.totalTime = timeStr;
      }
      
      if (!metadata.servings && (text.includes('serving') || text.includes('yield'))) {
        const servings = extractServingsFromText(section.textContent);
        if (servings) {
          metadata.servings = servings;
        }
      }
    }
  }

  // Strategy 6: Search all text nodes near labels for times
  if (!metadata.cookTime || !metadata.prepTime || !metadata.totalTime) {
    const allElements = articleElement.querySelectorAll('*');
    
    for (const element of allElements) {
      const text = element.textContent.trim();
      const lowerText = text.toLowerCase();
      
      // Skip if text is too long (likely contains more than just the metadata)
      if (text.length > 100) continue;
      
      // Look for "Prep Time: X" or "Prep: X" patterns
      if (!metadata.prepTime && /prep(?:aration)?\s*(?:time)?[\s:]/i.test(lowerText)) {
        const timeMatch = text.match(/prep(?:aration)?\s*(?:time)?[\s:]+(.+?)(?:\n|$|cook|total)/i);
        if (timeMatch && timeMatch[1]) {
          const cleanedTime = cleanTimeString(timeMatch[1].trim());
          if (cleanedTime && cleanedTime.length > 0 && cleanedTime.length < 50) {
            metadata.prepTime = cleanedTime;
          }
        }
      }
      
      // Look for "Cook Time: X" or "Cook: X" patterns
      if (!metadata.cookTime && /cook(?:ing)?\s*(?:time)?[\s:]/i.test(lowerText)) {
        const timeMatch = text.match(/cook(?:ing)?\s*(?:time)?[\s:]+(.+?)(?:\n|$|prep|total)/i);
        if (timeMatch && timeMatch[1]) {
          const cleanedTime = cleanTimeString(timeMatch[1].trim());
          if (cleanedTime && cleanedTime.length > 0 && cleanedTime.length < 50) {
            metadata.cookTime = cleanedTime;
          }
        }
      }
      
      // Look for "Total Time: X" patterns
      if (!metadata.totalTime && /total\s*(?:time)?[\s:]/i.test(lowerText)) {
        const timeMatch = text.match(/total\s*(?:time)?[\s:]+(.+?)(?:\n|$|prep|cook)/i);
        if (timeMatch && timeMatch[1]) {
          const cleanedTime = cleanTimeString(timeMatch[1].trim());
          if (cleanedTime && cleanedTime.length > 0 && cleanedTime.length < 50) {
            metadata.totalTime = cleanedTime;
          }
        }
      }
    }
  }

  // Strategy 7: Look for dd/dt pairs (definition lists)
  const dtElements = articleElement.querySelectorAll('dt');
  for (const dt of dtElements) {
    const text = dt.textContent.toLowerCase().trim();
    const dd = dt.nextElementSibling;
    
    if (dd && dd.tagName.toLowerCase() === 'dd') {
      const value = dd.textContent.trim();
      
      if ((text.includes('cook time') || text.includes('cooking time')) && !metadata.cookTime) {
        metadata.cookTime = value;
      } else if ((text.includes('prep time') || text.includes('preparation time')) && !metadata.prepTime) {
        metadata.prepTime = value;
      } else if (text.includes('total time') && !metadata.totalTime) {
        metadata.totalTime = value;
      } else if ((text.includes('serving') || text.includes('yield')) && !metadata.servings) {
        metadata.servings = extractServingsFromText(value);
      }
    }
  }

  return metadata;
}

// Helper function to extract metadata from schema.org structured data
function extractFromSchema(schema, metadata) {
  // Extract cook time
  if (schema.cookTime) {
    metadata.cookTime = parseISO8601Duration(schema.cookTime) || schema.cookTime;
  }
  
  // Extract prep time
  if (schema.prepTime) {
    metadata.prepTime = parseISO8601Duration(schema.prepTime) || schema.prepTime;
  }
  
  // Extract total time
  if (schema.totalTime) {
    metadata.totalTime = parseISO8601Duration(schema.totalTime) || schema.totalTime;
  }
  
  // Extract servings/yield
  if (schema.recipeYield) {
    if (typeof schema.recipeYield === 'string') {
      metadata.servings = extractServingsFromText(schema.recipeYield);
    } else if (typeof schema.recipeYield === 'number') {
      metadata.servings = schema.recipeYield;
    } else if (Array.isArray(schema.recipeYield) && schema.recipeYield.length > 0) {
      metadata.servings = extractServingsFromText(schema.recipeYield[0]);
    }
  }
}

// Helper function to parse ISO 8601 duration format (PT30M, PT1H30M, etc.)
function parseISO8601Duration(duration) {
  if (!duration || typeof duration !== 'string') return null;
  
  // Match ISO 8601 duration format
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return duration; // Return as-is if not ISO format
  
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
  
  return parts.join(' ') || duration;
}

// Helper function to extract time string from an element
function extractTimeString(element) {
  // Check for time element with datetime attribute
  const timeElement = element.querySelector('time[datetime]') || 
                     (element.tagName.toLowerCase() === 'time' ? element : null);
  
  if (timeElement) {
    const datetime = timeElement.getAttribute('datetime');
    if (datetime) {
      const parsed = parseISO8601Duration(datetime);
      const cleaned = cleanTimeString(parsed || timeElement.textContent.trim());
      if (cleaned) return cleaned;
    }
  }
  
  // Otherwise return text content
  const text = element.textContent.trim();
  const cleaned = cleanTimeString(text);
  return cleaned; // May be null if validation fails
}

// Helper function to clean time strings by removing labels
function cleanTimeString(text) {
  if (!text) return text;
  
  // Remove common time labels (case insensitive)
  // Handle both "Label: time" and "Label time" formats
  let cleaned = text
    .replace(/cook(?:ing)?\s*time\s*:?\s*/gi, '')
    .replace(/prep(?:aration)?\s*time\s*:?\s*/gi, '')
    .replace(/total\s*time\s*:?\s*/gi, '')
    .replace(/active\s*time\s*:?\s*/gi, '')
    .replace(/inactive\s*time\s*:?\s*/gi, '')
    .replace(/additional\s*time\s*:?\s*/gi, '')
    .replace(/^time\s*:?\s*/gi, '')
    .trim();
  
  // Remove any remaining colons at the start
  cleaned = cleaned.replace(/^:\s*/, '');
  
  // Remove duplicate time units (e.g., "35 minutes mins" -> "35 minutes")
  cleaned = removeDuplicateTimeUnits(cleaned);
  
  // Validate that it looks like a time value
  if (!isValidTimeString(cleaned)) {
    return null;
  }
  
  return cleaned;
}

// Helper function to remove duplicate time units from a string
function removeDuplicateTimeUnits(text) {
  if (!text) return text;
  
  // Define time unit groups (variations of the same unit)
  const timeUnitGroups = [
    ['hour', 'hours', 'hr', 'hrs', 'h'],
    ['minute', 'minutes', 'min', 'mins', 'm'],
    ['second', 'seconds', 'sec', 'secs', 's'],
    ['day', 'days', 'd']
  ];
  
  let result = text;
  
  // For each time unit group, check if there are duplicates
  for (const unitGroup of timeUnitGroups) {
    // Create a regex pattern to find numbers followed by any unit from this group
    // Example: (\d+)\s*(hour|hours|hr|hrs|h)\s*(hour|hours|hr|hrs|h)?
    const unitPattern = unitGroup.join('|');
    const regex = new RegExp(
      `(\\d+)\\s*(${unitPattern})\\s+(${unitPattern})\\b`,
      'gi'
    );
    
    // Replace duplicates with just the first occurrence
    // Keep the longer form (e.g., "minutes" over "mins")
    result = result.replace(regex, (match, number, unit1, unit2) => {
      // Prefer the longer/more formal unit name
      const longerUnit = unit1.length >= unit2.length ? unit1 : unit2;
      return `${number} ${longerUnit}`;
    });
  }
  
  return result.trim();
}

// Helper function to validate that a string looks like a time value
function isValidTimeString(text) {
  if (!text || text.length < 2) return false;
  
  const lower = text.toLowerCase();
  
  // Should contain time-related words or patterns
  const timeIndicators = [
    /\d+\s*hr/i,           // "2 hrs", "2hr"
    /\d+\s*hour/i,         // "2 hours"
    /\d+\s*min/i,          // "30 mins", "30min"
    /\d+\s*sec/i,          // "30 secs"
    /\d+\s*day/i,          // "2 days"
    /\d+:\d+/,             // "1:30"
  ];
  
  const hasTimeIndicator = timeIndicators.some(pattern => pattern.test(text));
  if (hasTimeIndicator) return true;
  
  // Check for time-related words
  const timeWords = ['minute', 'hour', 'second', 'day', 'min', 'hr', 'sec'];
  const hasTimeWord = timeWords.some(word => lower.includes(word));
  
  // Reject common non-time phrases
  const rejectPhrases = [
    'by equipment',
    'varies',
    'see note',
    'optional',
    'to taste',
    'as needed'
  ];
  
  const hasRejectPhrase = rejectPhrases.some(phrase => lower.includes(phrase));
  if (hasRejectPhrase) return false;
  
  return hasTimeWord;
}

// Helper function to extract time from text containing labels
function extractTimeFromText(text, timeType) {
  const patterns = {
    cook: /(?:cook(?:ing)?\s*time):\s*([^\n<]+)/i,
    prep: /(?:prep(?:aration)?\s*time):\s*([^\n<]+)/i,
    total: /(?:total\s*time):\s*([^\n<]+)/i
  };
  
  const pattern = patterns[timeType];
  if (!pattern) return null;
  
  const match = text.match(pattern);
  if (match && match[1]) {
    const cleaned = cleanTimeString(match[1].trim());
    return cleaned; // May be null if validation fails
  }
  
  return null;
}

// Helper function to extract servings as an integer
function extractServings(element) {
  const text = element.textContent.trim();
  return extractServingsFromText(text);
}

// Helper function to extract servings number from text
function extractServingsFromText(text) {
  if (!text) return null;
  
  // First, look for explicit servings in parentheses like "1 loaf (12 servings)"
  const parenthesesMatch = text.match(/\((\d+)\s*servings?\)/i);
  if (parenthesesMatch) {
    const num = parseInt(parenthesesMatch[1], 10);
    if (!isNaN(num) && num > 0 && num < 1000) {
      return num;
    }
  }
  
  // Look for "X servings" format first (more specific than just numbers)
  const servingsMatch = text.match(/(\d+)\s*servings?/i);
  if (servingsMatch) {
    const num = parseInt(servingsMatch[1], 10);
    if (!isNaN(num) && num > 0 && num < 1000) {
      return num;
    }
  }
  
  // Clean up the text
  const cleaned = text.toLowerCase()
    .replace(/yields?:?\s*/i, '')
    .replace(/makes:?\s*/i, '')
    .trim();
  
  // Look for number patterns
  // Match: "12", "12 servings", "serves 12", "12-14", "12 to 14"
  const patterns = [
    /serves?\s*(\d+)/i,        // "serves 12"
    /makes?\s*(\d+)/i,         // "makes 12"
    /(\d+)\s*portions?/i,      // "12 portions"
    /(\d+)\s*people?/i,        // "12 people"
    /^(\d+)(?:\s*-\s*\d+)?/    // "12" or "12-14" (last resort)
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0 && num < 1000) {
        return num;
      }
    }
  }
  
  return null;
}

// Example usage:
// const article = document.querySelector('article');
// const metadata = findRecipeMetadata(article);
// console.log('Recipe Metadata:', metadata);
// Output: { cookTime: "30 minutes", prepTime: "15 minutes", totalTime: "45 minutes", servings: 4 }
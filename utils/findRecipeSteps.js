function findRecipeSteps(articleElement) {
  if (!articleElement || !(articleElement instanceof HTMLElement)) {
    return [];
  }

  // Strategy 1: Look for schema.org Recipe structured data (most reliable)
  const schemaScript = articleElement.querySelector('script[type="application/ld+json"]');
  if (schemaScript) {
    try {
      const schema = JSON.parse(schemaScript.textContent);
      
      // Handle single object
      if (schema['@type'] === 'Recipe' || schema['@type'] === 'recipe') {
        if (schema.recipeInstructions) {
          return extractStepsFromSchema(schema.recipeInstructions);
        }
      }
      
      // Handle arrays of structured data
      if (Array.isArray(schema)) {
        const recipe = schema.find(item => item['@type'] === 'Recipe' || item['@type'] === 'recipe');
        if (recipe && recipe.recipeInstructions) {
          return extractStepsFromSchema(recipe.recipeInstructions);
        }
      }
    } catch (e) {
      // Invalid JSON, continue to other strategies
    }
  }

  // Strategy 2: Look for elements with instruction-related attributes
  const instructionSelectors = [
    '[class*="instruction" i]',
    '[class*="direction" i]',
    '[class*="step" i]',
    '[class*="recipe-step" i]',
    '[class*="recipe-instruction" i]',
    '[class*="recipe-direction" i]',
    '[id*="instruction" i]',
    '[id*="direction" i]',
    '[id*="step" i]',
    '[itemprop="recipeInstructions"]',
    '[data-instruction]',
    '[data-step]'
  ];

  for (const selector of instructionSelectors) {
    try {
      const container = articleElement.querySelector(selector);
      if (container) {
        const steps = extractStepsFromContainer(container);
        if (steps.length > 0) {
          return steps;
        }
      }
    } catch (e) {
      // Skip invalid selectors
      continue;
    }
  }

  // Strategy 3: Look for sections with heading containing instruction-related words
  const headings = articleElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const heading of headings) {
    const headingText = heading.textContent.toLowerCase();
    if (headingText.includes('instruction') || 
        headingText.includes('direction') || 
        headingText.includes('step') ||
        headingText.includes('preparation') ||
        headingText.includes('method') ||
        headingText.includes('how to make')) {
      const steps = extractStepsFromSection(heading);
      if (steps.length > 0) {
        return steps;
      }
    }
  }

  // Strategy 4: Look for ordered or unordered lists that appear to be instructions
  const lists = articleElement.querySelectorAll('ol, ul');
  for (const list of lists) {
    if (isLikelyInstructionList(list)) {
      const steps = extractStepsFromList(list);
      if (steps.length > 0) {
        return steps;
      }
    }
  }

  return [];
}

// Helper function to extract steps from schema.org structured data
function extractStepsFromSchema(recipeInstructions) {
  const steps = [];
  
  // Handle string format
  if (typeof recipeInstructions === 'string') {
    return recipeInstructions.split(/\n+/).map(s => s.trim()).filter(s => s.length > 0);
  }
  
  // Handle array format
  if (Array.isArray(recipeInstructions)) {
    recipeInstructions.forEach(instruction => {
      if (typeof instruction === 'string') {
        steps.push(instruction.trim());
      } else if (instruction['@type'] === 'HowToStep') {
        // HowToStep object with text property
        if (instruction.text) {
          steps.push(instruction.text.trim());
        }
      } else if (instruction['@type'] === 'HowToSection') {
        // HowToSection with nested steps
        if (instruction.itemListElement && Array.isArray(instruction.itemListElement)) {
          instruction.itemListElement.forEach(step => {
            if (step.text) {
              steps.push(step.text.trim());
            }
          });
        }
      }
    });
  }
  
  return steps.filter(step => step.length > 0);
}

// Helper function to extract steps from a container element
function extractStepsFromContainer(container) {
  const steps = [];
  
  // Try to find list items
  const listItems = container.querySelectorAll('li');
  if (listItems.length > 0) {
    listItems.forEach(item => {
      const text = item.textContent.trim();
      if (text && text.length > 0 && isLikelyInstruction(text)) {
        steps.push(text);
      }
    });
    return steps;
  }
  
  // Try to find paragraphs or divs with step-related classes
  const blocks = container.querySelectorAll('p, div[class*="step" i], div[class*="instruction" i]');
  blocks.forEach(block => {
    const text = block.textContent.trim();
    if (text && text.length > 0 && isLikelyInstruction(text)) {
      steps.push(text);
    }
  });
  
  return steps;
}

// Helper function to extract steps from section following a heading
function extractStepsFromSection(heading) {
  const steps = [];
  let currentElement = heading.nextElementSibling;
  
  // Traverse siblings until we hit another heading or run out of elements
  while (currentElement) {
    const tagName = currentElement.tagName.toLowerCase();
    
    // Stop if we hit another heading
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      break;
    }
    
    // Extract from lists
    if (tagName === 'ul' || tagName === 'ol') {
      const listItems = currentElement.querySelectorAll('li');
      listItems.forEach(item => {
        const text = item.textContent.trim();
        if (text && text.length > 0 && isLikelyInstruction(text)) {
          steps.push(text);
        }
      });
      
      // If we found steps, stop here
      if (steps.length > 0) {
        break;
      }
    }
    
    // Extract from paragraphs or divs
    if (tagName === 'p' || tagName === 'div') {
      const text = currentElement.textContent.trim();
      if (text && text.length > 0 && isLikelyInstruction(text)) {
        steps.push(text);
      }
    }
    
    currentElement = currentElement.nextElementSibling;
  }
  
  return steps;
}

// Helper function to extract steps from a list
function extractStepsFromList(list) {
  const steps = [];
  const listItems = list.querySelectorAll('li');
  
  listItems.forEach(item => {
    const text = item.textContent.trim();
    if (text && text.length > 0 && isLikelyInstruction(text)) {
      steps.push(text);
    }
  });
  
  return steps;
}

// Helper function to determine if a list is likely an instruction list
function isLikelyInstructionList(list) {
  // Ordered lists are more likely to be instructions
  if (list.tagName.toLowerCase() === 'ol') {
    const listItems = list.querySelectorAll('li');
    if (listItems.length > 0 && listItems.length <= 30) {
      return true;
    }
  }
  
  // Check parent elements for instruction-related classes
  let parent = list.parentElement;
  let depth = 0;
  
  while (parent && depth < 3) {
    const className = parent.className.toLowerCase();
    const id = parent.id.toLowerCase();
    
    if (className.includes('instruction') || 
        className.includes('direction') || 
        className.includes('step') ||
        className.includes('method') ||
        id.includes('instruction') || 
        id.includes('direction') || 
        id.includes('step')) {
      return true;
    }
    
    parent = parent.parentElement;
    depth++;
  }
  
  // Check if list items look like instructions
  const listItems = list.querySelectorAll('li');
  if (listItems.length === 0 || listItems.length > 30) {
    return false;
  }
  
  let instructionLikeCount = 0;
  for (let i = 0; i < Math.min(listItems.length, 5); i++) {
    if (isLikelyInstruction(listItems[i].textContent)) {
      instructionLikeCount++;
    }
  }
  
  return instructionLikeCount >= 2;
}

// Helper function to determine if text is likely an instruction
function isLikelyInstruction(text) {
  text = text.trim();
  
  // Filter out empty or very short text
  if (text.length < 10) {
    return false;
  }
  
  // Filter out extremely long text (might be multiple paragraphs)
  if (text.length > 1000) {
    return false;
  }
  
  const lowerText = text.toLowerCase();
  
  // Check for numbered step patterns - if it has a step number, it's definitely a step
  const hasStepNumber = /^(step\s+)?\d+[.:\)]/.test(lowerText);
  if (hasStepNumber) {
    return true;
  }
  
  // For unnumbered instructions, check for other indicators
  
  // Look for common cooking action verbs (instructions typically start with verbs)
  const cookingVerbs = [
    'preheat', 'heat', 'cook', 'bake', 'boil', 'simmer', 'fry', 'sauté', 'roast',
    'grill', 'mix', 'stir', 'whisk', 'beat', 'fold', 'combine', 'blend', 'chop',
    'dice', 'slice', 'mince', 'cut', 'add', 'pour', 'place', 'put', 'set',
    'remove', 'transfer', 'drain', 'rinse', 'wash', 'peel', 'season', 'sprinkle',
    'spread', 'brush', 'cover', 'wrap', 'refrigerate', 'freeze', 'let', 'allow',
    'bring', 'reduce', 'increase', 'lower', 'raise', 'flip', 'turn', 'toss',
    'garnish', 'serve', 'arrange', 'layer', 'prepare', 'marinate', 'coat',
    'toast', 'rub'
  ];
  
  const startsWithVerb = cookingVerbs.some(verb => {
    const pattern = new RegExp(`^${verb}\\b`, 'i');
    return pattern.test(lowerText);
  });
  
  // Look for time-related words (common in instructions)
  const timeWords = ['minute', 'minutes', 'hour', 'hours', 'second', 'seconds', 'until'];
  const hasTimeWord = timeWords.some(word => lowerText.includes(word));
  
  // Look for temperature references
  const hasTemperature = /\d+\s*°|degrees|fahrenheit|celsius/i.test(text);
  
  // Instructions often contain "and" connecting multiple actions
  const hasConnector = lowerText.includes(' and ') || lowerText.includes(', then ');
  
  // Filter out obvious non-instructions
  const nonInstructionPatterns = [
    /^(ingredients?|nutritional?|note|tip|variation)/i,
    /^(prep time|cook time|total time|servings?|yield)/i
  ];
  
  if (nonInstructionPatterns.some(pattern => pattern.test(text))) {
    return false;
  }
  
  return startsWithVerb || hasTimeWord || hasTemperature || hasConnector;
}

// Example usage:
// const article = document.querySelector('article');
// const steps = findRecipeSteps(article);
// console.log('Recipe Steps:', steps);
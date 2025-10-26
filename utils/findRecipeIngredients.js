function findRecipeIngredients(articleElement) {
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
        if (schema.recipeIngredient && Array.isArray(schema.recipeIngredient)) {
          return schema.recipeIngredient.map(ing => ing.trim()).filter(ing => ing.length > 0);
        }
      }
      
      // Handle arrays of structured data
      if (Array.isArray(schema)) {
        const recipe = schema.find(item => item['@type'] === 'Recipe' || item['@type'] === 'recipe');
        if (recipe && recipe.recipeIngredient && Array.isArray(recipe.recipeIngredient)) {
          return recipe.recipeIngredient.map(ing => ing.trim()).filter(ing => ing.length > 0);
        }
      }
    } catch (e) {
      // Invalid JSON, continue to other strategies
    }
  }

  // Strategy 2: Look for elements with ingredient-related attributes
  const ingredientSelectors = [
    '[class*="ingredient" i]',
    '[class*="recipe-ingredient" i]',
    '[id*="ingredient" i]',
    '[itemprop="recipeIngredient"]',
    '[itemprop="ingredients"]',
    '[data-ingredient]'
  ];

  for (const selector of ingredientSelectors) {
    try {
      const container = articleElement.querySelector(selector);
      if (container) {
        const ingredients = extractIngredientsFromContainer(container);
        if (ingredients.length > 0) {
          return ingredients;
        }
      }
    } catch (e) {
      // Skip invalid selectors
      continue;
    }
  }

  // Strategy 3: Look for sections with heading containing "ingredient"
  const headings = articleElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const heading of headings) {
    const headingText = heading.textContent.toLowerCase();
    if (headingText.includes('ingredient')) {
      const ingredients = extractIngredientsFromSection(heading);
      if (ingredients.length > 0) {
        return ingredients;
      }
    }
  }

  // Strategy 4: Look for unordered lists that appear to be ingredients
  const lists = articleElement.querySelectorAll('ul');
  for (const list of lists) {
    if (isLikelyIngredientList(list)) {
      const ingredients = extractIngredientsFromList(list);
      if (ingredients.length > 0) {
        return ingredients;
      }
    }
  }

  return [];
}

// Helper function to clean ingredient text
function cleanIngredientText(text) {
  return text
    .trim()
    .replace(/^▢\s*/, '') // Remove checkbox symbol at the start
    .replace(/^\u25A2\s*/, '') // Remove unicode ballot box
    .trim();
}

// Helper function to extract ingredients from a container element
function extractIngredientsFromContainer(container) {
  const ingredients = [];
  
  // Try to find list items
  const listItems = container.querySelectorAll('li');
  if (listItems.length > 0) {
    listItems.forEach(item => {
      const text = cleanIngredientText(item.textContent);
      if (text && text.length > 0 && isLikelyIngredient(text)) {
        ingredients.push(text);
      }
    });
    return ingredients;
  }
  
  // Try to find paragraphs or divs
  const blocks = container.querySelectorAll('p, div[class*="ingredient" i]');
  blocks.forEach(block => {
    const text = cleanIngredientText(block.textContent);
    if (text && text.length > 0 && isLikelyIngredient(text)) {
      ingredients.push(text);
    }
  });
  
  return ingredients;
}

// Helper function to extract ingredients from section following a heading
function extractIngredientsFromSection(heading) {
  const ingredients = [];
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
        const text = cleanIngredientText(item.textContent);
        if (text && text.length > 0 && isLikelyIngredient(text)) {
          ingredients.push(text);
        }
      });
      
      // If we found ingredients, stop here
      if (ingredients.length > 0) {
        break;
      }
    }
    
    currentElement = currentElement.nextElementSibling;
  }
  
  return ingredients;
}

// Helper function to extract ingredients from a list
function extractIngredientsFromList(list) {
  const ingredients = [];
  const listItems = list.querySelectorAll('li');
  
  listItems.forEach(item => {
    const text = cleanIngredientText(item.textContent);
    if (text && text.length > 0 && isLikelyIngredient(text)) {
      ingredients.push(text);
    }
  });
  
  return ingredients;
}

// Helper function to determine if a list is likely an ingredient list
function isLikelyIngredientList(list) {
  // Check parent elements for ingredient-related classes
  let parent = list.parentElement;
  let depth = 0;
  
  while (parent && depth < 3) {
    const className = parent.className.toLowerCase();
    const id = parent.id.toLowerCase();
    
    if (className.includes('ingredient') || id.includes('ingredient')) {
      return true;
    }
    
    parent = parent.parentElement;
    depth++;
  }
  
  // Check if list items look like ingredients
  const listItems = list.querySelectorAll('li');
  if (listItems.length === 0 || listItems.length > 50) {
    return false;
  }
  
  let ingredientLikeCount = 0;
  for (let i = 0; i < Math.min(listItems.length, 5); i++) {
    if (isLikelyIngredient(listItems[i].textContent)) {
      ingredientLikeCount++;
    }
  }
  
  return ingredientLikeCount >= 2;
}

// Helper function to determine if text is likely an ingredient
function isLikelyIngredient(text) {
  text = text.toLowerCase().trim();
  
  // Filter out empty or very short text
  if (text.length < 2) {
    return false;
  }
  
  // Filter out very long text (likely instructions)
  if (text.length > 200) {
    return false;
  }
  
  // Filter out common instruction words
  const instructionWords = ['step', 'preheat', 'bake', 'cook', 'mix', 'stir', 'pour', 'add to', 'combine'];
  if (instructionWords.some(word => text.startsWith(word))) {
    return false;
  }
  
  // Look for common measurement units or ingredient patterns
  const measurementUnits = [
    'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp',
    'ounce', 'ounces', 'oz', 'pound', 'pounds', 'lb', 'lbs', 'gram', 'grams', 'g',
    'kilogram', 'kg', 'liter', 'liters', 'milliliter', 'ml', 'pinch', 'dash',
    'clove', 'cloves', 'bunch', 'piece', 'pieces', 'can', 'package', 'jar'
  ];
  
  const hasUnit = measurementUnits.some(unit => {
    const pattern = new RegExp(`\\b${unit}\\b`, 'i');
    return pattern.test(text);
  });
  
  // Look for common ingredient-related words
  const ingredientKeywords = [
    'oil', 'butter', 'flour', 'sugar', 'salt', 'pepper', 'egg', 'milk', 'water',
    'cheese', 'chicken', 'beef', 'pork', 'fish', 'garlic', 'onion', 'tomato'
  ];
  
  const hasKeyword = ingredientKeywords.some(keyword => text.includes(keyword));
  
  // Also check for numeric patterns (amounts)
  const hasNumber = /\d/.test(text);
  
  return hasUnit || hasKeyword || hasNumber;
}

// Example usage:
// const article = document.querySelector('article');
// const ingredients = findRecipeIngredients(article);
// console.log('Recipe Ingredients:', ingredients);
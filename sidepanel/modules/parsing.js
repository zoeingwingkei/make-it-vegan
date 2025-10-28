export function parseLLMBoolean(response) {
  // Handle null/undefined/empty
  if (response == null || response === '') {
    return null;
  }

  // Convert to string and normalize
  const normalized = String(response)
    .trim()
    .toLowerCase();

  // Handle empty strings after trim
  if (normalized === '') {
    return null;
  }

  // Check for explicit true/false at the start
  if (normalized.startsWith('true')) {
    return true;
  }
  if (normalized.startsWith('false')) {
    return false;
  }

  // Check for yes/no patterns
  if (/^(yes|y)\b/i.test(normalized)) {
    return true;
  }
  if (/^(no|n)\b/i.test(normalized)) {
    return false;
  }

  // Check for affirmative/negative keywords at the start
  const affirmativeWords = ['correct', 'affirmative', 'confirmed', 'indeed', 'absolutely'];
  const negativeWords = ['incorrect', 'negative', 'denied', 'nope'];

  for (const word of affirmativeWords) {
    if (normalized.startsWith(word)) {
      return true;
    }
  }

  for (const word of negativeWords) {
    if (normalized.startsWith(word)) {
      return false;
    }
  }

  // Can't determine - return null
  return null;
}

export function parseLLMJSON(response) {
  try {
    // Remove potential markdown code fences
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/```\n?/g, '');
    }

    // Parse JSON
    const parsed = JSON.parse(cleanResponse.trim());

    // Validate structure
    if (parsed.vegan_recipe && Array.isArray(parsed.vegan_recipe)) {
      return parsed.vegan_recipe;
    } else if (parsed.vegan_steps && Array.isArray(parsed.vegan_steps)) {
      return parsed.vegan_steps;
    }
    else {
      console.error("Response missing 'vegan_recipe' or 'vegan_steps' array");
      return [];
    }

  } catch (error) {
    console.error("Failed to parse AI response:", error);
    console.error("Raw response:", response);
    return [];
  }
}

export function extractSubstitutions(veganIngredients) {
  // Filter only ingredients with substitutions (containing <del>)
  const substitutions = veganIngredients
    .filter(ing => ing.includes('<del>'))
    .map(ing => {
      // Try format: "<del>original</del> → [replacement]"
      let delMatch = ing.match(/<del>(.*?)<\/del>\s*→\s*\[(.*?)\]/);

      // Try format: "<del>original</del> → <b>replacement</b>"
      if (!delMatch) {
        delMatch = ing.match(/<del>(.*?)<\/del>\s*→\s*<b>(.*?)<\/b>/);
      }

      // Try format: "<del>original</del> → replacement" (no brackets or tags)
      if (!delMatch) {
        delMatch = ing.match(/<del>(.*?)<\/del>\s*→\s*([^,\n]+)/);
      }

      if (delMatch) {
        return {
          original: delMatch[1].trim(),
          replacement: delMatch[2].trim()
        };
      }
      return null;
    })
    .filter(sub => sub !== null);

  // Generate output messages
  const messages = substitutions.map(sub =>
    `replace ${sub.original} with ${sub.replacement}.`
  );

  return messages;
}
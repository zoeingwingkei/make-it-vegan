/* global LanguageModel */

// let currentRecipeTitle = null;
// let currentRecipeImageSrc = null;

const recipeTitleElement = document.body.querySelector('#recipe-title');
const recipeImageElement = document.body.querySelector('#recipe-image');

// // Read the recipe info from local storage when the side panel loads
// async function loadRecipeInfo(){
//   const recipeTitle = await chrome.storage.local.get('recipeTitle');
//   const recipeImage = await chrome.storage.local.get('recipeImage');

//   currentRecipeTitle = recipeTitle.recipeTitle || "Title Not Found";
//   currentRecipeImageSrc = recipeImage.recipeImage || "Image Not Found";

//   updateRecipeDisplay();
// }

// loadRecipeInfo();

// // Listen for recipe updates
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.type === "RECIPE_UPDATED") {
//     loadRecipeInfo();
//   }
// });

// // Listen for local storage changes
// chrome.storage.onChanged.addListener((changes, area) => {
//   if (area === 'local') {
//     loadRecipeInfo();
//   }
// });

async function updateRecipeDisplay(recipeData) {
  recipeTitleElement.innerText = recipeData.title || "Title Not Found";
  recipeImageElement.src = recipeData.image || "Image Not Found";
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'UPDATE_RECIPE_DATA') {
    updateRecipeDisplay(message.recipeData);
  }
});

async function initializeSidePanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const stored = await chrome.storage.local.get(`recipe_${tab.id}`);
  const recipeData = stored[`recipe_${tab.id}`];
  
  if (recipeData) {
    updateRecipeDisplay(recipeData);
  } else {
    // If no data is found, request it from the content script
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'GET_RECIPE_DATA',
      });
      updateRecipeDisplay(response);
    } catch (error) {
      console.error('Error initializing side panel:', error);
    }
  }
}

initializeSidePanel();
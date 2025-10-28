chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));
  }
});

// Listen for tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('Tab activated: ', activeInfo.tabId);
  await updateSidePanel(activeInfo.tabId);
});

// Listen for tab updates (when page finishes loading)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    await updateSidePanel(tabId);
  }
});

async function updateSidePanel(tabId) {
  try {
    // Inject content script into the active tab to ensure we can access the recipe data
    console.log('Injecting content script into tab: ', tabId);
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["utils/findCoverImg.js", "utils/findRecipeTitle.js", "utils/findRecipeIngredients.js", "utils/findRecipeSteps.js","utils/findRecipeMetaData.js", "content.js"],
    });

    // Get the recipe data from content.js
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'GET_RECIPE_DATA',
    })
    console.log('Received recipe data from content script: ', response);

    // Store the recipe data in local storage
    await chrome.storage.local.set({
      [`recipe_${tabId}`]: response,
    })

    // Notify index.js to update the side panel with the new recipe data
    chrome.runtime.sendMessage({
      action: 'UPDATE_RECIPE_DATA',
      recipeData: response,
      tabId: tabId
    }).catch((error) => {
      // Side panel might not be ready... that's okay, we'll just log the error for now. The side panel will update when it initializes.
      console.log('Side panel is not ready to receive messages: ', error);
    });

  } catch (error) {
    console.log('Error updating side panel:', error);
  }
}

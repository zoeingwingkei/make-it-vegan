chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));
  }
});

// // Listen for tab changes
// chrome.tabs.onActivated.addListener((activeInfo) => {
//   if (activeInfo.tabId) {
//     chrome.tabs.sendMessage(activeInfo.tabId, {
//       type: 'UPDATE_RECIPE',
//     });
//   }
// });

// // Listen for tab updates (e.g., URL changes)
// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//   if (changeInfo.status === 'complete' && tab.active) {
//     chrome.tabs.sendMessage(tabId, {
//       type: 'UPDATE_RECIPE',
//     });
//   }
// });

// Listen for tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener(async(activeInfo) => {
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
    // Get the recipe data from content.js
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'GET_RECIPE_DATA',
    })

    // Store the recipe data in local storage
    await chrome.storage.local.set({
      [`recipe_${tabId}`]: response,
    })

    // Notify index.js to update the side panel with the new recipe data
    chrome.runtime.sendMessage({
      action: 'UPDATE_RECIPE_DATA',
      recipeData: response,
      tabId: tabId
    })

  } catch (error) {
    console.error('Error updating side panel:', error);
  }
}
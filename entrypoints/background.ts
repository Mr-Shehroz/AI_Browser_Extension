export default defineBackground(() => {
  // Clicking the toolbar icon opens Zoya in the side panel.
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
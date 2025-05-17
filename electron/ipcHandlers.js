// ipcHandlers.js
module.exports = {
  publishRednote: async (data) => {
    console.log("🦄🦄publishRednote called with data:", data);
    try {
      // logic here
      console.log("🦄🦄publishRednote executing...");
      return { success: true };
    } catch (error) {
      console.error("Error in publishRednote:", error);
      return { error: error.message };
    }
  },
};

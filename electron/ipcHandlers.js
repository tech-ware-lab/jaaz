// ipcHandlers.js
const { chromium, BrowserContext } = require("playwright");
const path = require("path");
const { app } = require("electron");

module.exports = {
  publishPost: async (event, data) => {
    console.log("🦄🦄publishPost called with data:", data);
    try {
      if (data.channel === "xiaohongshu") {
        await publishXiaohongshu(data);
      }
    } catch (error) {
      console.error("Error in publish post:", error);
      return { error: error.message };
    }
  },
};

const userDataDir = app.getPath("userData");
/** @type {BrowserContext | null} */
let browser;

/**
 * @typedef {Object} PublishData
 * @property {"youtube" | "bilibili" | "douyin" | "xiaohongshu"} channel - The platform to publish to
 * @property {string} title - The title of the post
 * @property {string} content - The content of the post
 * @property {string[]} images - Array of image paths
 * @property {string} video - Path to the video file
 */

/**
 * @param {PublishData} data - The data for publishing the post
 */
async function publishXiaohongshu(data) {
  if (!browser) {
    browser = await chromium.launchPersistentContext(
      path.join(userDataDir, "browser_data"),
      {
        headless: false,
      }
    );
  }
  const page = await browser.newPage();
  try {
    await page.goto("https://creator.xiaohongshu.com/publish/publish");

    // Wait for the upload container to be visible
    try {
      await page.waitForSelector(".upload-container", { timeout: 5000 });
    } catch (error) {
      throw new Error("Please login to Xiaohongshu first");
    }

    // Check if video upload tab exists
    const videoTab = await page.$('.creator-tab:has-text("上传视频")');
    if (!videoTab) {
      throw new Error("Video upload tab not found on the page");
    }

    // Click on "上传视频" (Upload Video) button
    await videoTab.click();

    // Wait for the file input to be visible
    await page.waitForSelector('input[type="file"]');

    // Check if video path exists in data
    if (!data.video) {
      throw new Error("No video file path provided in data");
    }

    // Upload the video file
    await page.setInputFiles('input[type="file"]', data.video);

    // Wait for upload progress to appear
    await page.waitForSelector(".uploading", { timeout: 10000 });

    // Wait for upload to complete (100%)
    while (true) {
      const progressText = await page.$eval(
        ".uploading .stage",
        (el) => el.textContent
      );
      // Match the text that contains "上传中" followed by a percentage
      const progressMatch = progressText?.match(/上传中\s*(\d+)%/);

      if (!progressMatch) {
        throw new Error("Could not find upload progress percentage");
      }

      const progress = parseInt(progressMatch[1]);
      console.log(`⏳Upload progress: ${progress}%`);

      if (progress === 100) {
        console.log("Upload completed!");
        break;
      }

      // Wait a bit before checking again
      await page.waitForTimeout(1000);
    }

    // Wait a bit more to ensure the upload is fully processed
    await page.waitForTimeout(5000);
  } catch (error) {
    console.error("Error during video upload:", error);
    throw error;
  } finally {
    // await page.close();
  }
}

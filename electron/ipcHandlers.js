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
      } else if (data.channel === "bilibili") {
        await publishBilibili(data);
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

async function launchBrowser() {
  const context = await chromium.launchPersistentContext(
    path.join(userDataDir, "browser_data"),
    {
      headless: false,
      channel: "chrome",
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars", // hides "Chrome is being controlled" banner
      ],
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      viewport: null,
      ignoreDefaultArgs: ["--enable-automation"],
    }
  );

  return context;
}

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
    browser = await launchBrowser();
  }
  const page = await browser.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
  });
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

    // Wait a bit more to ensure the upload is fully processed
    await page.waitForTimeout(1000);

    const [content, uploadComplete] = await Promise.all([
      fillXiaohongshuContent(page, data.title, data.content),
      waitForXiaohongshuUploadComplete(page),
    ]);

    console.log("🦄🦄uploadComplete:", uploadComplete);

    // Wait a bit to ensure content is properly set
    await page.waitForTimeout(1000);
  } catch (error) {
    console.error("Error during video upload:", error);
    throw error;
  } finally {
    // await page.close();
  }
}

async function fillXiaohongshuContent(page, title, content) {
  // fill in title
  await page.waitForSelector(
    'input.d-text[placeholder="填写标题会有更多赞哦～"]',
    { timeout: 10000 } // Increase timeout if necessary
  );

  // Focus on the input field
  await page.focus('input.d-text[placeholder="填写标题会有更多赞哦～"]');
  await page.fill(
    'input.d-text[placeholder="填写标题会有更多赞哦～"]',
    title || ""
  );

  // Fill in the content by clipboard copying pasting
  await page.evaluate(async (text) => {
    await navigator.clipboard.writeText(text);
  }, content || "");
  await page.waitForTimeout(1000);
  await page.waitForSelector(".ql-editor");
  await page.focus(".ql-editor");
  //   await page.keyboard.type(content || "", { delay: 100 });
  console.log("platform:", process.platform);
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+V" : "Control+V"
  );
  await page.waitForTimeout(2000);
  // add hashtags
  const tags = getTagsFromContent(content || "");
  console.log("🦄🦄tags:", tags);
  for (const tag of tags) {
    await page.keyboard.type("#");
    await page.waitForTimeout(100);
    await page.keyboard.type(tag, { delay: 300 });
    await page.waitForTimeout(1000);
    await page.keyboard.press("Enter");
  }

  await page.waitForTimeout(1000);

  return true;
}

async function waitForXiaohongshuUploadComplete(page) {
  // Wait for upload to complete (100%)
  while (true) {
    const progressText = await page.evaluate(() => {
      return document.querySelector(".stage")?.textContent || "";
    });

    // Check if the text contains "上传成功" (Upload Successful)
    if (progressText.includes("上传成功")) {
      console.log("Upload completed!");
      return true;
    }

    // Match the text that contains "上传中" followed by a percentage
    const progressMatch = progressText.match(/上传中\s*(\d+)%/);

    if (!progressMatch) {
      throw new Error("Could not find upload progress percentage");
    }

    const progress = parseInt(progressMatch[1]);
    console.log(`⏳Upload progress: ${progress}%`);

    if (progress === 99) {
      console.log("Upload completed!");
      break;
    }

    // Wait a bit before checking again
    await page.waitForTimeout(3000);
  }
  return false;
}

/**
 * @param {PublishData} data - The data for publishing the post
 */

async function publishBilibili(data) {
  if (!browser) {
    browser = await launchBrowser();
  }
  const page = await browser.newPage();
  try {
    await page.goto("https://member.bilibili.com/platform/upload/video/frame");
    await page.waitForTimeout(3000); // Let Vue UI settle

    // Ensure the "上传视频" button is visible and clickable
    const uploadButton = await page.waitForSelector(".bcc-upload-wrapper", {
      timeout: 10000,
      state: "visible",
    });

    // Listen for the file chooser BEFORE clicking
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      uploadButton.click(), // This triggers file picker
    ]);

    // Use the filechooser to set your file
    await fileChooser.setFiles(data.video);

    console.log("File selected via file chooser");
  } catch (err) {
    console.error("Upload error:", err);
    throw err;
  }
}

/**
 * @param {string} content - The content of the post
 * @returns {string[]} - The tags of the post
 */
function getTagsFromContent(content) {
  const tags = content.match(/#(\w+)/g);
  const ret = tags ? tags.map((tag) => tag.slice(1)) : [];
  console.log("🦄🦄ret:", ret);
  return ret;
}

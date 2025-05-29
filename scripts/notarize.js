const { notarize } = require("electron-notarize");

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") return;

  return await notarize({
    appBundleId: "com.jaaz.app",
    appPath: `${appOutDir}/Jaaz.app`, // Replace with your actual .app name
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_PASSWORD,
    teamId: process.env.TEAM_ID,
  });
};

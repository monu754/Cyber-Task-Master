const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const appJsonPath = path.join(projectRoot, "app.json");
const debugApkPath = path.join(projectRoot, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");

function readPackageId() {
  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
    return appJson?.expo?.android?.package || "com.monu24.taskmanagerapp";
  } catch {
    return "com.monu24.taskmanagerapp";
  }
}

function resolveAdbPath() {
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk"),
  ].filter(Boolean);

  for (const sdkRoot of sdkRoots) {
    const adbPath = path.join(sdkRoot, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
    if (fs.existsSync(adbPath)) {
      return adbPath;
    }
  }

  return process.platform === "win32" ? "adb.exe" : "adb";
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.captureOutput ? "pipe" : "inherit",
    shell: options.shell || false,
  });
}

function runAsync(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: { ...process.env, ...options.env },
      stdio: options.stdio || "inherit",
      shell: options.shell || false,
    });

    child.on("error", (error) => {
      resolve({ status: null, error });
    });

    child.on("exit", (code, signal) => {
      resolve({ status: code, signal, error: null });
    });
  });
}

function reportSpawnError(step, result) {
  if (!result?.error) {
    return;
  }

  console.error(`${step} failed to start: ${result.error.message}`);
}

function getDevices(adbPath) {
  const result = run(adbPath, ["devices"], { captureOutput: true });
  if (result.error) {
    reportSpawnError("adb devices", result);
    return [];
  }
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;

  if (result.status !== 0) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts[1] === "device")
    .map((parts) => parts[0]);
}

function installDirectly(adbPath, deviceId) {
  if (!fs.existsSync(debugApkPath)) {
    return false;
  }

  console.log("\nRetrying APK install after freeing space...");
  const installResult = run(adbPath, ["-s", deviceId, "install", "-r", "-d", "--user", "0", debugApkPath]);
  if (installResult.error) {
    reportSpawnError("adb install", installResult);
    return false;
  }
  return installResult.status === 0;
}

function launchApp(adbPath, deviceId, packageId) {
  console.log(`Launching ${packageId} on ${deviceId}...`);
  const launchResult = run(adbPath, [
    "-s",
    deviceId,
    "shell",
    "monkey",
    "-p",
    packageId,
    "-c",
    "android.intent.category.LAUNCHER",
    "1",
  ]);

  if (launchResult.error) {
    reportSpawnError("adb shell monkey", launchResult);
    return false;
  }

  return launchResult.status === 0;
}

async function main() {
  const packageId = readPackageId();
  const adbPath = resolveAdbPath();
  const connectedDevices = getDevices(adbPath);
  const emulatorId = connectedDevices.find((deviceId) => deviceId.startsWith("emulator-"));

  const env = {};

  if (emulatorId && !process.env.ORG_GRADLE_PROJECT_reactNativeArchitectures) {
    env.ORG_GRADLE_PROJECT_reactNativeArchitectures = "x86_64";
    console.log(`Detected ${emulatorId}. Building a lean x86_64 debug APK to reduce install size.`);
  }

  const expoCliPath = require.resolve("expo/bin/cli");
  let result = await runAsync(process.execPath, [expoCliPath, "run:android"], { env });

  if (result.error && process.platform === "win32") {
    result = await runAsync("cmd.exe", ["/d", "/s", "/c", `"${process.execPath}" "${expoCliPath}" run:android`], {
      env,
    });
  }

  if (result.error) {
    reportSpawnError("expo run:android", result);
    process.exit(1);
  }

  if (result.status === 0) {
    process.exit(0);
  }

  if (!emulatorId) {
    process.exit(result.status || 1);
  }

  console.log(`\nExpo run:android exited before staying attached. Trying a direct APK install fallback for ${emulatorId}...`);
  run(adbPath, ["-s", emulatorId, "uninstall", packageId]);
  run(adbPath, ["-s", emulatorId, "shell", "pm", "trim-caches", "256M"]);

  const installSucceeded = installDirectly(adbPath, emulatorId);
  if (installSucceeded) {
    launchApp(adbPath, emulatorId, packageId);
  }
  process.exit(installSucceeded ? 0 : result.status || 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

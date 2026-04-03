const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const appJsonPath = path.join(projectRoot, "app.json");
const debugApkPath = path.join(projectRoot, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const isWindows = process.platform === "win32";

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
    const adbPath = path.join(sdkRoot, "platform-tools", isWindows ? "adb.exe" : "adb");
    if (fs.existsSync(adbPath)) {
      return adbPath;
    }
  }

  return isWindows ? "adb.exe" : "adb";
}

function resolveEmulatorPath() {
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk"),
  ].filter(Boolean);

  for (const sdkRoot of sdkRoots) {
    const emulatorPath = path.join(sdkRoot, "emulator", isWindows ? "emulator.exe" : "emulator");
    if (fs.existsSync(emulatorPath)) {
      return emulatorPath;
    }
  }

  return isWindows ? "emulator.exe" : "emulator";
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

function listAvds(emulatorPath) {
  const result = run(emulatorPath, ["-list-avds"], { captureOutput: true });
  if (result.error || result.status !== 0) {
    return [];
  }

  return `${result.stdout || ""}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDevice(adbPath, predicate, timeoutMs = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const matchedDevice = getDevices(adbPath).find(predicate);
    if (matchedDevice) {
      return matchedDevice;
    }
    await sleep(2000);
  }

  return null;
}

function getDeviceBootState(adbPath, deviceId) {
  const result = run(adbPath, ["-s", deviceId, "shell", "getprop", "sys.boot_completed"], {
    captureOutput: true,
  });

  if (result.error || result.status !== 0) {
    return "";
  }

  return `${result.stdout || ""}`.trim();
}

async function waitForBootComplete(adbPath, deviceId, timeoutMs = 180000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (getDeviceBootState(adbPath, deviceId) === "1") {
      return true;
    }
    await sleep(3000);
  }

  return false;
}

async function ensureEmulatorReady(adbPath) {
  const connectedDevices = getDevices(adbPath);
  const runningEmulator = connectedDevices.find((deviceId) => deviceId.startsWith("emulator-"));
  if (runningEmulator) {
    const booted = await waitForBootComplete(adbPath, runningEmulator, 20000);
    return booted ? runningEmulator : null;
  }

  const emulatorPath = resolveEmulatorPath();
  const avds = listAvds(emulatorPath);
  const preferredAvd =
    process.env.ANDROID_AVD_NAME ||
    avds.find((name) => /Medium_Phone_API_36\.1/i.test(name)) ||
    avds[0];

  if (!preferredAvd) {
    return null;
  }

  console.log(`Starting emulator ${preferredAvd} and waiting for Android to finish booting...`);
  const emulatorProcess = spawn(emulatorPath, ["-avd", preferredAvd], {
    cwd: projectRoot,
    detached: true,
    stdio: "ignore",
    shell: false,
  });
  emulatorProcess.unref();

  const deviceId = await waitForDevice(adbPath, (id) => id.startsWith("emulator-"), 120000);
  if (!deviceId) {
    return null;
  }

  const booted = await waitForBootComplete(adbPath, deviceId, 180000);
  return booted ? deviceId : null;
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

function prepareDeviceForInstall(adbPath, deviceId, packageId) {
  console.log(`Preparing ${deviceId} for install...`);
  run(adbPath, ["-s", deviceId, "uninstall", packageId]);
  run(adbPath, ["-s", deviceId, "shell", "pm", "trim-caches", "512M"]);
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
  const emulatorId = await ensureEmulatorReady(adbPath);

  const env = {};

  if (emulatorId && !process.env.ORG_GRADLE_PROJECT_reactNativeArchitectures) {
    env.ORG_GRADLE_PROJECT_reactNativeArchitectures = "x86_64";
    console.log(`Detected ${emulatorId}. Building a lean x86_64 debug APK to reduce install size.`);
  }

  if (emulatorId) {
    prepareDeviceForInstall(adbPath, emulatorId, packageId);
    env.ANDROID_SERIAL = emulatorId;
    console.log(`Using Android target ${emulatorId}.`);
  } else {
    console.warn("No booted Android emulator detected. Expo may prompt for a device manually.");
  }

  const expoCliPath = require.resolve("expo/bin/cli");
  let result = await runAsync(process.execPath, [expoCliPath, "run:android"], { env });

  if (result.error && isWindows) {
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

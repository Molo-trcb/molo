/* oxlint-disable no-console */
/* oxlint-disable @typescript-oxlint/no-var-requires */
/* oxlint-disable no-undef */
const { exec } = require("child_process");
const { readdirSync, existsSync, copyFileSync, mkdirSync, rmSync, cpSync } = require("fs");
const path = require("path");

const getDirectories = (source) =>
  readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

/**
 * Executes a shell command and return it as a Promise.
 * @param cmd {string}
 * @return {Promise<string>}
 */
function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { shell: process.platform === "win32" ? "bash" : undefined }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout ? stdout : stderr);
      }
    });
  });
}

function copyFileSafe(src, dest) {
  try {
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  } catch (_err) {
    // ignore missing optional files
  }
}

async function build() {
  // Clean previous build
  console.log("Clean previous build…");

  try {
    rmSync("./build/server", { recursive: true, force: true });
  } catch (_err) {
    console.warn("Could not clean build/server (files may be locked), continuing...");
  }
  try {
    rmSync("./build/plugins", { recursive: true, force: true });
  } catch (_err) {
    console.warn("Could not clean build/plugins (files may be locked), continuing...");
  }

  const d = getDirectories("./plugins");

  // Compile server and shared
  console.log("Compiling…");
  await Promise.all([
    execAsync(
      "yarn babel --extensions .ts,.tsx --quiet -d ./build/server ./server"
    ),
    execAsync(
      "yarn babel --extensions .ts,.tsx --quiet -d ./build/shared ./shared"
    ),
  ]);

  for (const plugin of d) {
    const hasServer = existsSync(`./plugins/${plugin}/server`);

    if (hasServer) {
      await execAsync(
        `yarn babel --extensions .ts,.tsx --quiet -d "./build/plugins/${plugin}/server" "./plugins/${plugin}/server"`
      );
    }

    const hasShared = existsSync(`./plugins/${plugin}/shared`);

    if (hasShared) {
      await execAsync(
        `yarn babel --extensions .ts,.tsx --quiet -d "./build/plugins/${plugin}/shared" "./plugins/${plugin}/shared"`
      );
    }
  }

  // Copy static files
  console.log("Copying static files…");
  copyFileSafe("./server/collaboration/Procfile", "./build/server/collaboration/Procfile");
  copyFileSafe("./server/static/error.dev.html", "./build/server/error.dev.html");
  copyFileSafe("./server/static/error.prod.html", "./build/server/error.prod.html");
  copyFileSafe("./package.json", "./build/package.json");
  cpSync("./shared/i18n/locales", "./build/shared/i18n/locales", { recursive: true });

  for (const plugin of d) {
    copyFileSafe(
      `./plugins/${plugin}/plugin.json`,
      `./build/plugins/${plugin}/plugin.json`
    );
  }

  console.log("Done!");
}

void build();

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "smol-toml";

const getConfigPath = (): string => {
  let currentDir: string;
  
  if (typeof __dirname !== "undefined") {
    currentDir = __dirname;
  } else {
    // @ts-ignore — import.meta is valid in ESM; this branch is unreachable under CommonJS
    currentDir = dirname(fileURLToPath(import.meta.url));
  }
  
  // Try current directory first
  let configPath = join(currentDir, "config.toml");
  if (existsSync(configPath)) {
    return configPath;
  }
  
  // Try parent directory
  configPath = join(dirname(currentDir), "config.toml");
  if (existsSync(configPath)) {
    return configPath;
  }
  
  // Try to find workspace root by looking for package.json with workspaces
  let searchDir = currentDir;
  for (let i = 0; i < 10; i++) {
    const packageJsonPath = join(searchDir, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      
      // Check if this is the workspace root
      if (packageJson.workspaces || existsSync(join(searchDir, "pnpm-workspace.yaml"))) {

        // Found workspace root, check packages/config/config.toml
        configPath = join(searchDir, "packages", "config", "config.toml");
        if (existsSync(configPath)) {
          return configPath;
        }
      }
    }
    const parentDir = dirname(searchDir);
    if (parentDir === searchDir) break; // Reached filesystem root
    searchDir = parentDir;
  }
  
  // Fallback to current directory
  return join(currentDir, "config.toml");
};

export interface WebConfig {
  development: boolean;
  address: string;
  port: number;
  ports: number[];
  loginUrl: string;
  cdnUrl: string;
  maintenance: {
    enable: boolean;
    message: string;
  };
  tls: {
    key: string;
    cert: string;
  };
}

export interface WebFrontendConfig {
  root: string;
  port: number;
  tls: {
    key: string;
    cert: string;
  };
}

export interface ServerConfig {
  bypassVersionCheck: boolean;
  logLevel: string;
}

export interface Config {
  web: WebConfig;
  webFrontend: WebFrontendConfig;
  server: ServerConfig;
}

const configPath = getConfigPath();
const configContent = readFileSync(configPath, "utf-8");
const config = parse(configContent) as unknown as Config;
const frontend = () => {
  return {
    tls: {
      key: readFileSync(config.webFrontend.tls.key),
      cert: readFileSync(config.webFrontend.tls.cert),
    },
  };
};
const logon = () => {
  return {
    tls: {
      key: readFileSync(config.web.tls.key),
      cert: readFileSync(config.web.tls.cert),
    },
  };
};

export * from "./eslint.js";
export { config, frontend, logon };

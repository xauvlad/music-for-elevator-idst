import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';

async function collectPngFiles(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return collectPngFiles(fullPath);
      }

      return entry.isFile() && fullPath.toLowerCase().endsWith('.png') ? [fullPath] : [];
    })
  );

  return files.flat();
}

async function convertPngToWebp(projectRoot: string): Promise<{ converted: number; skipped: number }> {
  const publicDir = path.join(projectRoot, 'public');

  try {
    await fs.access(publicDir);
  } catch {
    return { converted: 0, skipped: 0 };
  }

  const pngFiles = await collectPngFiles(publicDir);
  const { default: sharp } = await import('sharp');

  let converted = 0;
  let skipped = 0;

  for (const pngPath of pngFiles) {
    const webpPath = pngPath.replace(/\.png$/i, '.webp');
    let shouldConvert = true;

    try {
      const [pngStat, webpStat] = await Promise.all([fs.stat(pngPath), fs.stat(webpPath)]);
      shouldConvert = pngStat.mtimeMs > webpStat.mtimeMs;
    } catch {
      // The WebP file may not exist yet. In that case we convert.
      shouldConvert = true;
    }

    if (!shouldConvert) {
      skipped += 1;
      continue;
    }

    await sharp(pngPath).webp({ quality: 82 }).toFile(webpPath);
    converted += 1;
  }

  return { converted, skipped };
}

function pngToWebpPlugin(): Plugin {
  let hasRun = false;
  let projectRoot = process.cwd();

  return {
    name: 'png-to-webp',
    configResolved(config) {
      projectRoot = config.root;
    },
    async configureServer(server) {
      if (hasRun) {
        return;
      }

      hasRun = true;

      try {
        const { converted, skipped } = await convertPngToWebp(projectRoot);
        server.config.logger.info(`[png-to-webp] (dev) converted: ${converted}, skipped: ${skipped}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        server.config.logger.warn(`[png-to-webp] (dev) failed: ${message}`);
      }
    },
    async buildStart() {
      if (hasRun) {
        return;
      }

      hasRun = true;

      try {
        const { converted, skipped } = await convertPngToWebp(projectRoot);
        this.info(`[png-to-webp] (build) converted: ${converted}, skipped: ${skipped}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.warn(`[png-to-webp] (build) failed: ${message}`);
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), pngToWebpPlugin()],
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['music-for-elevator-xauvlad.amvera.io', '.amvera.io', 'idst-musicforelevator.ru']
  }
});

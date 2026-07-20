// cli.ts
import { Command } from 'commander';
import { VideoConfigSchema } from './src/types/schema';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';

const program = new Command();

program
  .name('content-auto')
  .description('Render videos from scene-based JSON using Remotion engine')
  .version('0.1.0');

// ─── Validate command ────────────────────────────────

program
  .command('validate')
  .description('Validate a scene JSON file without rendering')
  .argument('<input>', 'Path to scene JSON file')
  .action(async (inputPath: string) => {
    const resolvedPath = path.resolve(inputPath);

    if (!fs.existsSync(resolvedPath)) {
      console.error(`❌ File not found: ${resolvedPath}`);
      process.exit(1);
    }

    try {
      const raw = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
      const parsed = VideoConfigSchema.parse(raw);

      console.log(`✅ JSON is valid.`);
      console.log(`   Title: ${parsed.metadata.title}`);
      console.log(
        `   Resolution: ${parsed.metadata.resolution.width}x${parsed.metadata.resolution.height}`,
      );
      console.log(`   FPS: ${parsed.metadata.fps}`);
      console.log(`   Scenes: ${parsed.scenes.length}`);
      console.log(`   Total duration: ${parsed.metadata.duration}s`);
      console.log(`   Audio: ${parsed.audio ? `BGM ${parsed.audio.bgm}` : 'none'}`);

      // Check scene assets exist
      for (const scene of parsed.scenes) {
        if (scene.type === 'image') {
          const assetPath = path.resolve(path.dirname(resolvedPath), scene.data.src);
          if (!fs.existsSync(assetPath)) {
            console.warn(`⚠️  Asset not found: ${scene.data.src} (relative to JSON file)`);
          }
        }
        if (scene.type === 'video_clip') {
          const assetPath = path.resolve(path.dirname(resolvedPath), scene.data.src);
          if (!fs.existsSync(assetPath)) {
            console.warn(`⚠️  Video clip source not found: ${scene.data.src} (relative to JSON file)`);
          }
        }
      }

      if (parsed.audio?.bgm) {
        const bgmPath = path.resolve(path.dirname(resolvedPath), parsed.audio.bgm);
        if (!fs.existsSync(bgmPath)) {
          console.warn(`⚠️  BGM file not found: ${parsed.audio.bgm} (relative to JSON file)`);
        }
      }
    } catch (err: any) {
      if (err.issues) {
        // Zod validation error
        console.error('❌ JSON validation failed:');
        for (const issue of err.issues) {
          console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
        }
      } else {
        console.error(`❌ Invalid JSON: ${err.message}`);
      }
      process.exit(1);
    }
  });

// ─── Render command ──────────────────────────────────

program
  .command('render')
  .description('Render a video from scene JSON')
  .argument('<input>', 'Path to scene JSON file')
  .option('-o, --output <path>', 'Output MP4 file path', 'output/video.mp4')
  .option('--codec <codec>', 'Video codec', 'h264')
  .action(async (inputPath: string, options: { output: string; codec: string }) => {
    const resolvedInput = path.resolve(inputPath);
    const resolvedOutput = path.resolve(options.output);

    // Ensure output directory exists
    const outputDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Load and validate JSON
    console.log('📄 Loading scene JSON...');
    let config;
    try {
      const raw = JSON.parse(fs.readFileSync(resolvedInput, 'utf-8'));
      config = VideoConfigSchema.parse(raw);
    } catch (err: any) {
      if (err.issues) {
        console.error('❌ JSON validation failed:');
        for (const issue of err.issues) {
          console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
        }
      } else {
        console.error(`❌ Error: ${err.message}`);
      }
      process.exit(1);
    }

    console.log(`✅ Valid JSON: "${config.metadata.title}"`);
    console.log(
      `   ${config.metadata.resolution.width}x${config.metadata.resolution.height} @ ${config.metadata.fps}fps`,
    );
    console.log(`   ${config.scenes.length} scenes, ${config.metadata.duration}s total`);

    // 2. Bundle
    console.log('📦 Bundling Remotion project...');
    // When run via tsx, __dirname is not available in ESM. Use import.meta.url
    const entryPoint = path.resolve(
      typeof __dirname !== 'undefined' ? __dirname : path.dirname(new URL(import.meta.url).pathname),
      'src',
      'index.ts',
    );
    const bundleLocation = await bundle({
      entryPoint,
    });
    console.log(`✅ Bundle ready: ${bundleLocation}`);

    // 3. Select composition
    console.log('🎬 Selecting composition...');
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'content-auto-video',
      inputProps: config,
    });
    console.log(
      `✅ Composition: ${composition.id} (${composition.durationInFrames} frames)`,
    );

    // 4. Render
    console.log('🎥 Rendering video...');
    const startTime = Date.now();

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: options.codec as 'h264',
      outputLocation: resolvedOutput,
      inputProps: config,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Render complete: ${resolvedOutput}`);
    console.log(`⏱️  Rendered in ${elapsed}s`);
  });

program.parse();

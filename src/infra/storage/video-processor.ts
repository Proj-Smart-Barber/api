import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm, stat } from "node:fs/promises";
import { join, resolve, sep, basename } from "node:path";
import { tmpdir } from "node:os";
const run = promisify(execFile);
const ffmpeg = require("ffmpeg-static") as string;
const ffprobe = (require("ffprobe-static") as { path: string }).path;
/** Dedicated worker only: one bounded file and one encoder per job. */
export async function processVideo(input: Buffer) {
  if (input.length > 100 * 1024 * 1024) throw new Error("Vídeo excede 100 MB.");
  const directory = await mkdtemp(join(tmpdir(), "barber-video-"));
  if (
    !resolve(directory).startsWith(resolve(tmpdir()) + sep) ||
    !basename(directory).startsWith("barber-video-")
  )
    throw new Error("Diretório temporário inválido.");
  try {
    const source = join(directory, "original");
    const output = join(directory, "main.mp4");
    const poster = join(directory, "poster.webp");
    await writeFile(source, input);
    const probe = await run(
      ffprobe,
      [
        "-v",
        "error",
        "-max_alloc",
        "268435456",
        "-protocol_whitelist",
        "file,pipe",
        "-show_format",
        "-show_streams",
        "-of",
        "json",
        source,
      ],
      { timeout: 15000, maxBuffer: 1024 * 1024, windowsHide: true },
    );
    const metadata = JSON.parse(probe.stdout);
    const video = metadata.streams.find(
      (stream: { codec_type?: string; width?: number; height?: number }) =>
        stream.codec_type === "video",
    );
    const duration = Number(metadata.format.duration);
    if (
      !String(metadata.format.format_name)
        .split(",")
        .some((format) => format === "mov" || format === "mp4") ||
      !video ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 60 ||
      Number(video.width) * Number(video.height) > 3840 * 2160
    )
      throw new Error("Vídeo inválido: máximo 60 segundos e entrada até 4K.");
    await run(
      ffmpeg,
      [
        "-nostdin",
        "-v",
        "error",
        "-max_alloc",
        "268435456",
        "-protocol_whitelist",
        "file,pipe",
        "-enable_drefs",
        "0",
        "-use_absolute_path",
        "0",
        "-i",
        source,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-vf",
        "scale=w='min(720,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
        "-c:v",
        "libx264",
        "-threads",
        "2",
        "-filter_threads",
        "1",
        "-preset",
        "fast",
        "-crf",
        "26",
        "-maxrate",
        "2M",
        "-bufsize",
        "4M",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-map_metadata",
        "-1",
        "-movflags",
        "+faststart",
        "-t",
        "60",
        "-y",
        output,
      ],
      { timeout: 240000, maxBuffer: 1024 * 1024, windowsHide: true },
    );
    if ((await stat(output)).size > 20 * 1024 * 1024)
      throw new Error("Vídeo processado excede 20 MB.");
    await run(
      ffmpeg,
      [
        "-nostdin",
        "-v",
        "error",
        "-i",
        output,
        "-frames:v",
        "1",
        "-vf",
        "scale=480:-2",
        "-c:v",
        "libwebp",
        "-quality",
        "70",
        "-y",
        poster,
      ],
      { timeout: 15000, maxBuffer: 1024 * 1024, windowsHide: true },
    );
    const result = await run(
      ffprobe,
      ["-v", "error", "-show_streams", "-of", "json", output],
      { timeout: 15000, maxBuffer: 1024 * 1024, windowsHide: true },
    );
    const stream = JSON.parse(result.stdout).streams.find(
      (stream: { codec_type?: string; width?: number; height?: number }) =>
        stream.codec_type === "video",
    );
    const posterBuffer = await readFile(poster);
    if (posterBuffer.length > 150 * 1024)
      throw new Error("Poster excede o limite.");
    return {
      main: await readFile(output),
      poster: posterBuffer,
      width: Number(stream.width),
      height: Number(stream.height),
      duration,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

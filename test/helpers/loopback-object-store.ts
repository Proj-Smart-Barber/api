import http from "node:http";
import type { AddressInfo } from "node:net";

export interface StoredObject {
  key: string;
  buffer: Buffer;
  contentType: string;
  contentLength: number;
}

export class LoopbackObjectStore {
  private server: http.Server;
  private objects = new Map<string, StoredObject>();
  private port = 0;

  constructor() {
    this.server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
      // Strip leading slash and bucket prefix if path style
      let pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      // E.g. "test-bucket/media/avatar.png" -> "media/avatar.png"
      const parts = pathname.split("/");
      if (parts.length > 1) {
        parts.shift(); // Remove bucket name
        pathname = parts.join("/");
      }

      const method = req.method?.toUpperCase();

      if (method === "PUT") {
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const contentType = req.headers["content-type"] || "application/octet-stream";
          this.objects.set(pathname, {
            key: pathname,
            buffer,
            contentType,
            contentLength: buffer.length,
          });
          res.writeHead(200, {
            "ETag": '"test-etag-12345"',
            "Content-Length": "0",
          });
          res.end();
        });
        return;
      }

      if (method === "HEAD") {
        const obj = this.objects.get(pathname);
        if (!obj) {
          res.writeHead(404, { "Content-Type": "application/xml" });
          res.end("<Error><Code>NoSuchKey</Code></Error>");
          return;
        }
        res.writeHead(200, {
          "Content-Type": obj.contentType,
          "Content-Length": obj.contentLength.toString(),
          "ETag": '"test-etag-12345"',
        });
        res.end();
        return;
      }

      if (method === "GET") {
        const obj = this.objects.get(pathname);
        if (!obj) {
          res.writeHead(404, { "Content-Type": "application/xml" });
          res.end("<Error><Code>NoSuchKey</Code></Error>");
          return;
        }
        res.writeHead(200, {
          "Content-Type": obj.contentType,
          "Content-Length": obj.contentLength.toString(),
          "ETag": '"test-etag-12345"',
        });
        res.end(obj.buffer);
        return;
      }

      if (method === "DELETE") {
        this.objects.delete(pathname);
        res.writeHead(204);
        res.end();
        return;
      }

      res.writeHead(405);
      res.end();
    });
  }

  async start(): Promise<string> {
    return new Promise((resolve) => {
      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server.address() as AddressInfo;
        this.port = addr.port;
        resolve(`http://127.0.0.1:${this.port}`);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  getEndpoint(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  putObject(key: string, buffer: Buffer, contentType: string) {
    this.objects.set(key, {
      key,
      buffer,
      contentType,
      contentLength: buffer.length,
    });
  }

  getObject(key: string): StoredObject | undefined {
    return this.objects.get(key);
  }

  clear() {
    this.objects.clear();
  }
}

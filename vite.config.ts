import path from "path"
import type { IncomingMessage, ServerResponse } from "node:http"
import { defineConfig, loadEnv, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fetchHoroscope, parseHoroscopeQuery } from "./vite/horoscopeProxy"
import { fetchExamPdfBytes, parseExamPdfStoragePath, extractFirebaseIdToken } from "./vite/examPdfProxy"

function examPdfDevProxy(storageBucket: string): Plugin {

  return {
    name: "exam-pdf-dev-proxy",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url?.startsWith("/api/exam-pdf")) {
          next()
          return
        }

        if (!storageBucket) {
          res.statusCode = 500
          res.setHeader("Content-Type", "text/plain")
          res.end("VITE_FIREBASE_STORAGE_BUCKET is not configured")
          return
        }

        const url = new URL(req.url, "http://localhost")
        const storagePath = parseExamPdfStoragePath(url.searchParams.get("path"))
        if (!storagePath) {
          res.statusCode = 400
          res.setHeader("Content-Type", "text/plain")
          res.end("Invalid path")
          return
        }

        const authHeader = req.headers.authorization
        const idToken = extractFirebaseIdToken(authHeader)
        if (!idToken) {
          res.statusCode = 401
          res.setHeader("Content-Type", "text/plain")
          res.end("Unauthorized")
          return
        }

        try {
          const buffer = await fetchExamPdfBytes(storagePath, idToken, storageBucket)
          res.statusCode = 200
          res.setHeader("Content-Type", "application/pdf")
          res.setHeader("Cache-Control", "private, max-age=3600")
          res.end(Buffer.from(buffer))
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error"
          res.statusCode = 502
          res.setHeader("Content-Type", "text/plain")
          res.end(message)
        }
      })
    },
  }
}

function horoscopeDevProxy(): Plugin {
  return {
    name: "horoscope-dev-proxy",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url?.startsWith("/api/horoscope")) {
          next()
          return
        }

        const url = new URL(req.url, "http://localhost")
        const parsed = parseHoroscopeQuery(
          url.searchParams.get("sign") ?? "",
          url.searchParams.get("day") ?? "today",
        )

        if (!parsed) {
          res.statusCode = 400
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({ error: "Invalid sign or day" }))
          return
        }

        try {
          const data = await fetchHoroscope(parsed.sign, parsed.day)
          res.statusCode = 200
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify(data))
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error"
          res.statusCode = 502
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({ error: message }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET ?? ""

  return {
    plugins: [
      react(),
      tailwindcss(),
      horoscopeDevProxy(),
      examPdfDevProxy(storageBucket),
    ],
    server: {
      port: 3000,
      strictPort: false, // เปลี่ยนเป็น false เพื่อให้รันพอร์ตอื่นอัตโนมัติถ้า 3000 ไม่ว่าง
    },
    preview: {
      port: 3000,
      strictPort: false,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom"
      ],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return

            if (id.includes("/xlsx/") || id.includes("\\xlsx\\")) return "vendor-xlsx"
            if (id.includes("/pdfjs-dist/") || id.includes("\\pdfjs-dist\\")) return "vendor-pdfjs"
            if (id.includes("/react-pdf/") || id.includes("\\react-pdf\\")) return "vendor-pdfjs"
            if (id.includes("/jspdf") || id.includes("\\jspdf")) return "vendor-jspdf"
            if (id.includes("/html2canvas") || id.includes("\\html2canvas")) return "vendor-html2canvas"
            if (id.includes("/recharts") || id.includes("\\recharts")) return "vendor-recharts"
            if (id.includes("firestore") && (id.includes("@firebase") || id.includes("/firebase/"))) {
              return "vendor-firestore"
            }
            if (id.includes("firebase/auth") || id.includes("@firebase/auth")) {
              return "vendor-firebase-auth"
            }
            if (id.includes("firebase/storage") || id.includes("@firebase/storage")) {
              return "vendor-firebase-storage"
            }
            if (id.includes("firebase/app") || id.includes("@firebase/app")) {
              return "vendor-firebase-app"
            }
            if (id.includes("@firebase/") || id.includes("@firebase\\")) return "vendor-firebase-misc"
            if (id.includes("/firebase/") || id.includes("\\firebase\\")) return "vendor-firebase-misc"
          },
        },
      },
    },
  }
})
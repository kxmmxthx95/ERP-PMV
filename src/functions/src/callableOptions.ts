/** Gen2 callable — CORS + public invoker (Gen1 preflight มักโดน IAM block บน browser) */
export const CALLABLE_REGION = "asia-southeast1";

export const CALLABLE_CORS = [
  "https://pmv1-90180.web.app",
  "https://pmv1-90180.firebaseapp.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vite.config.js",
    test: {
      name: "client",
      include: ["src/**/*.test.{js,jsx}"],
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.js"],
      css: true,
    },
  },
  {
    test: {
      name: "server",
      include: ["server/**/*.test.js"],
      environment: "node",
      globals: true,
    },
  },
]);

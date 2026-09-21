import path from "path";
import { defineConfig, normalizePath } from "vite";
import rollupLicensePlugin from "rollup-plugin-license";
import typescriptPlugin from "vite-plugin-typescript";
import dtsBundleGeneratorPlugin from "vite-plugin-dts-bundle-generator";

export default defineConfig({
  build: {
    lib: {
      entry: normalizePath(path.resolve(__dirname, "src", "index.ts")),
      name: "transition",
      fileName: (format) => {
        switch (format) {
          case "umd":
            return "transition.umd.js";
          case "cjs":
            return "transition.cjs";
          default:
            return "transition.js";
        }
      },
      formats: ["es", "umd", "cjs"],
    },
    minify: false,
    sourcemap: true,
  },
  plugins: [
    rollupLicensePlugin({
      sourcemap: true,
      banner: getLicense(),
    }),
    typescriptPlugin({}),
    dtsBundleGeneratorPlugin({
      fileName: "transition.d.ts",
    }),
  ],
});

function getLicense() {
  const version = process.env.npm_package_version;
  const year = new Date().getFullYear();
  return `
Transition.js v${version ?? "?"}
@copyright Copyright ${year} Ali Shakiba
@license Licensed under the MIT (https://github.com/piqnt/transition.js/blob/main/LICENSE.md)
  `;
}

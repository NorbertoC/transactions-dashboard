// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(resolve(root, file), "utf8");
const manifest = JSON.parse(read("docs/fonts/manifest.json")) as {
  families: { family: string; cssUrl: string; licenseUrl: string }[];
  fonts: { family: string; file: string; sha256: string; bytes: number; url: string; preload: boolean }[];
};
const css = read("src/app/fonts.css");
const layout = read("src/app/layout.tsx");
const faces = [...css.matchAll(/@font-face\{([^}]+)\}/g)].map(match => match[1]);

describe("bundled official fonts", () => {
  it("ships every source as an intact, content-addressed WOFF2 asset", () => {
    expect(manifest.fonts).toHaveLength(15);
    for (const font of manifest.fonts) {
      const bytes = readFileSync(resolve(root, "src/app/fonts", font.file));
      expect(bytes.toString("ascii", 0, 4)).toBe("wOF2");
      expect(bytes.length).toBe(font.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(font.sha256);
      expect(font.file).toContain(font.sha256.slice(0, 16));
      expect(new URL(font.url).hostname).toBe("fonts.gstatic.com");
      expect(css).toContain(`./fonts/${font.file}`);
    }
    const cssFiles = [...new Set([...css.matchAll(/src:url\(\.\/fonts\/([^\)]+)\)/g)].map(match => match[1]))];
    expect(cssFiles.sort()).toEqual(manifest.fonts.map(font => font.file).sort());
  });

  it("preserves the previous weights, subsets and fallback metrics", () => {
    expect(faces.filter(face => face.startsWith("font-family:Inter;"))).toHaveLength(35);
    for (const weight of [400, 500, 600, 700, 900]) {
      expect(faces.filter(face => face.startsWith("font-family:Inter;") && face.includes(`font-weight:${weight};`))).toHaveLength(7);
    }
    expect(faces.filter(face => face.startsWith("font-family:DM Sans;") && face.includes("font-weight:100 1000;"))).toHaveLength(2);
    expect(faces.filter(face => face.startsWith("font-family:Manrope;") && face.includes("font-weight:200 800;"))).toHaveLength(6);
    expect(faces.filter(face => face.includes("src:url"))).toSatisfy((values: string[]) => values.every(face => face.includes("font-display:swap;") && face.includes("unicode-range:")));
    for (const [family, size] of [["Inter", "107.12%"], ["DM Sans", "104.53%"], ["Manrope", "103.19%"]]) {
      expect(faces.find(face => face.startsWith(`font-family:${family} Fallback;`))).toContain(`size-adjust:${size}`);
    }
  });

  it("preloads exactly the three Latin subsets without a remote font loader", () => {
    const preloads = manifest.fonts.filter(font => font.preload);
    expect(preloads.map(font => font.family).sort()).toEqual(["dmsans", "inter", "manrope"]);
    for (const font of preloads) {
      expect(layout).toContain(`from "./fonts/${font.file}"`);
      expect(faces.filter(face => face.includes(font.file))).toSatisfy((values: string[]) => values.every(face => /unicode-range:u\+(?:0-ff|00\?\?)[,;]/.test(face)));
    }
    expect(layout).not.toContain("next/font/google");
    expect(layout).toContain('import "./fonts.css"');
    expect(layout.match(/as="font" type="font\/woff2" crossOrigin="anonymous"/g)).toHaveLength(3);
    expect(css).not.toMatch(/https?:/);
  });

  it("includes each official source and redistribution license", () => {
    for (const family of manifest.families) {
      expect(new URL(family.cssUrl).hostname).toBe("fonts.googleapis.com");
      expect(family.licenseUrl).toMatch(/^https:\/\/raw\.githubusercontent\.com\/google\/fonts\/[a-f0-9]{40}\/ofl\//);
      expect(read(`docs/fonts/${family.family}-OFL.txt`)).toContain("SIL OPEN FONT LICENSE Version 1.1");
    }
  });
});

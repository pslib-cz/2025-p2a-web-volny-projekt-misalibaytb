const __m = [
  168, 208, 210, 230, 64, 230, 198, 228, 210, 224, 232, 64, 210, 230, 64, 200,
  222, 220, 202, 64, 196, 242, 64, 218, 210, 230, 194, 216, 210, 196, 194, 64,
  80, 208, 232, 232, 224, 230, 116, 94, 94, 206, 210, 232, 208, 234, 196, 92,
  198, 222, 218, 94, 218, 210, 230, 194, 216, 210, 196, 194, 242, 232, 196, 64,
  76, 64, 208, 232, 232, 224, 230, 116, 94, 94, 218, 210, 230, 194, 216, 210,
  196, 194, 92, 202, 234, 82,
];
console.log(String.fromCharCode(...__m.map((value) => value >> 1)));

import { execFileSync } from "child_process";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { format } from "prettier";

type ComponentCondition = {
  arg: string;
  value: string;
};

type ComponentBlock = {
  condition: ComponentCondition | null;
  code: string;
};

type Component = {
  name: string;
  sourceFile: string;
  args: string[];
  htmlArgs: string[];
  optionalArgs: string[];
  defaultArgs: Record<string, string>;
  optionalAttributeArgs: string[];
  blocks: ComponentBlock[];
};

type ImageLayout = {
  kind: "fixed" | "fluid" | "unknown";
  fixedWidth: number | null;
  minWidth: number | null;
  maxWidth: number | null;
  sizes: string;
  matchedCss: string[];
};

type HtmlElementContext = {
  tagName: string;
  attrs: Record<string, string>;
};

type CssImageRule = {
  selector: string;
  declarations: Record<string, string>;
  specificity: number;
  order: number;
  mediaConditions: string[];
};

type ImageFormat = "avif" | "webp" | "png" | "jpeg";

type ImageVariant = {
  width: number;
  file: string;
  publicPath: string;
  format: ImageFormat;
};

type NeededWidthCandidate = {
  width: number;
  source: string;
  devicePixelRatio: number;
};

type NeededWidthPlan = {
  widths: number[];
  candidates: NeededWidthCandidate[];
  sourceByWidth: Map<number, string>;
  largestCandidate: NeededWidthCandidate | null;
};

type OptimizedImageSet = {
  formats: ImageFormat[];
  variantsByFormat: Record<ImageFormat, ImageVariant[]>;
};

type FaviconAsset = {
  rel: string;
  href: string;
  size: number | null;
  type: string | null;
};

type FaviconBuild = {
  sourceFile: string;
  assets: FaviconAsset[];
};

type FaviconRounding =
  | {
      kind: "none";
    }
  | {
      kind: "circle";
    }
  | {
      kind: "percent";
      value: number;
    }
  | {
      kind: "px";
      value: number;
    };

type FaviconSource = {
  sourceFile: string;
  rounding: FaviconRounding;
};

type LiveReloadSocketData = {
  route: string;
};

type LiveReloadMessage =
  | {
      type: "html-update";
      route: string;
      html: string;
    }
  | {
      type: "css-update";
      href: string;
    }
  | {
      type: "reload";
      route?: string;
    };

type StylesheetLayerName =
  | "base"
  | "typography"
  | "layout"
  | "components"
  | "utilities";

type StylesheetLayer = {
  name: StylesheetLayerName;
  filename: string;
  aliases: string[];
};

const componentPrefix = "misaliba";
const componentsFolder = "./components";
const publicFolder = "./public";
const distFolder = "./dist";

const optimizedImagesFolder = path.join(distFolder, "assets", "images");
const generatedIconsFolder = path.join(distFolder, "assets", "icons");
const generatedStylesFolder = path.join(distFolder, "assets", "styles");

const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".avif"];
const passthroughImageExtensions = [".svg", ".gif"];

const commonViewportWidths = [
  320, 360, 375, 390, 414, 430, 768, 820, 1024, 1280, 1366, 1440, 1536, 1728,
  1920,
];
const commonDevicePixelRatios = [1, 1.5, 2, 3];
const minGeneratedImageWidth = 24;
const supportedImageFormats: ImageFormat[] = ["avif", "webp", "png", "jpeg"];
const defaultOutputImageFormats: ImageFormat[] = ["avif", "webp"];
const imageFormatsArg = process.argv.find((arg) => {
  return arg.startsWith("--image-formats=") || arg.startsWith("--formats=");
});
const isDebugImages = process.argv.includes("--debug-images");
const siteUrlArg = process.argv.find((arg) => {
  return (
    arg.startsWith("--site-url=") ||
    arg.startsWith("--domain=") ||
    arg.startsWith("--origin=")
  );
});

const components: Component[] = [];
const cssImageRules: CssImageRule[] = [];
const pageStylesheetComponentCssFiles = new Map<string, Set<string>>();
const emittedStylesheetSnapshots = new Map<string, string>();
const stylesheetLayers: StylesheetLayer[] = [
  {
    name: "base",
    filename: "base.css",
    aliases: ["base"],
  },
  {
    name: "typography",
    filename: "typography.css",
    aliases: ["typography", "type"],
  },
  {
    name: "layout",
    filename: "layout.css",
    aliases: ["layout"],
  },
  {
    name: "components",
    filename: "components.css",
    aliases: ["components", "component"],
  },
  {
    name: "utilities",
    filename: "utilities.css",
    aliases: ["utilities", "utility"],
  },
];
const stylesheetLayerChunks = new Map<StylesheetLayerName, string[]>();

const optimizedImageCache = new Map<string, OptimizedImageSet>();
const imageNameUsage = new Map<string, Set<string>>();
const emittedWarnings = new Set<string>();
const emittedErrors = new Set<string>();
let faviconBuild: FaviconBuild | null = null;
const htmlRouteSnapshots = new Map<string, string>();
const publicFileSnapshots = new Map<string, string>();
const currentBuildSeenRoutes = new Set<string>();
const currentBuildSeenPublicFiles = new Set<string>();
const currentBuildHtmlUpdates = new Map<string, string>();
const currentBuildCssUpdates = new Set<string>();
let currentBuildReloadAll = false;
let previousBuildHtmlRoutes = new Set<string>();

const isWatchMode = process.argv.includes("watch");
const isServeMode = process.argv.includes("serve");
const isHelpMode = process.argv.some((arg) => {
  return arg === "help" || arg === "--help" || arg === "-h";
});
const portArg = process.argv.find((arg) => {
  return arg.startsWith("--port=");
});
const servePort = portArg ? Number(portArg.split("=")[1]) : 3000;
const rebuildDelayMs = 1000;
const useColor = !process.env.NO_COLOR;
const color = (code: number, value: string) => {
  return useColor ? `\u001b[${code}m${value}\u001b[0m` : value;
};
const cyan = (value: string) => color(36, value);
const green = (value: string) => color(32, value);
const yellow = (value: string) => color(33, value);
const red = (value: string) => color(31, value);
const dim = (value: string) => color(2, value);
const bold = (value: string) => color(1, value);

const formatSourcePath = (filename: string) => {
  const relativePath = path.relative(".", filename).replaceAll(path.sep, "/");

  return relativePath.startsWith(".") ? filename : relativePath;
};

const normalizeImageFormat = (formatName: string): ImageFormat | null => {
  const normalized = formatName.trim().toLowerCase();

  if (normalized === "jpg" || normalized === "jpe") {
    return "jpeg";
  }

  if (supportedImageFormats.includes(normalized as ImageFormat)) {
    return normalized as ImageFormat;
  }

  return null;
};

const parseOutputImageFormats = (rawValue: string | undefined) => {
  if (!rawValue) {
    return defaultOutputImageFormats;
  }

  const formats: ImageFormat[] = [];

  for (const rawFormat of rawValue.split(",")) {
    const formatName = normalizeImageFormat(rawFormat);

    if (formatName && !formats.includes(formatName)) {
      formats.push(formatName);
    }
  }

  return formats.length > 0 ? formats : defaultOutputImageFormats;
};

const outputImageFormats = parseOutputImageFormats(
  imageFormatsArg?.split("=").slice(1).join("="),
);

const isInsideFolder = (folder: string, filename: string) => {
  const relativePath = path.relative(folder, filename);

  return (
    relativePath.length > 0 &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
};

const logInfo = (message: string) => {
  console.log(`${cyan("info")} ${message}`);
};

const logSuccess = (message: string) => {
  console.log(`${green("done")} ${message}`);
};

const logWarning = (key: string, message: string) => {
  if (emittedWarnings.has(key)) {
    return;
  }

  emittedWarnings.add(key);
  console.log(`${yellow("warn")} ${message}`);
};

const logError = (message: string) => {
  console.error(`${red("error")} ${message}`);
};

const logErrorOnce = (key: string, message: string) => {
  if (emittedErrors.has(key)) {
    return;
  }

  emittedErrors.add(key);
  logError(message);
};

const normalizeSiteUrl = (value: string | undefined) => {
  const rawValue = value?.trim();

  if (!rawValue) {
    return null;
  }

  try {
    const url = new URL(
      rawValue.startsWith("http://") || rawValue.startsWith("https://")
        ? rawValue
        : `https://${rawValue}`,
    );

    const pathname = url.pathname.replace(/\/+$/, "");

    return {
      origin: url.origin,
      basePath: pathname === "/" ? "" : pathname,
      href: `${url.origin}${pathname === "/" ? "" : pathname}`,
    };
  } catch {
    logWarning("site-url:invalid", `Invalid site URL ignored: ${rawValue}`);
    return null;
  }
};

const siteUrl = normalizeSiteUrl(
  siteUrlArg?.split("=").slice(1).join("=") ??
    process.env.SITE_URL ??
    process.env.SITE_ORIGIN ??
    process.env.DOMAIN,
);

let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
let isBuilding = false;
let rebuildRequested = false;
let liveReloadServer: Bun.Server<LiveReloadSocketData> | null = null;
const liveReloadSockets = new Set<Bun.ServerWebSocket<LiveReloadSocketData>>();

const printHelp = () => {
  console.log(`Usage:
  bun ./compile.ts [watch] [serve] [--port=3000] [--site-url=https://example.com] [--image-formats=avif,webp] [--debug-images] [help|--help|-h]

Modes:
  watch         Rebuild on file changes
  serve         Rebuild on file changes and start the Bun web server
  help          Show this message

Flags:
  --port=PORT    Port for serve mode, default 3000
  --site-url=URL Treat absolute URLs from this site as local public assets
  --domain=URL   Alias for --site-url
  --image-formats=LIST
                Comma-separated optimized image formats, default avif,webp
                Supported: avif, webp, png, jpeg (jpg aliases to jpeg)
  --formats=LIST Alias for --image-formats
  --debug-images Log image width decisions and DPR candidates

Notes:
  - HTML updates are pushed to the open page without a full reload when possible
  - CSS changes hot-swap linked stylesheets
  - JS file changes still trigger a full reload`);
};

const recursiveScan = async (
  folder: string,
  callback: (filename: string, data: string) => void | Promise<void>,
) => {
  if (!fs.existsSync(folder)) {
    return;
  }

  for (const file of fs.readdirSync(folder)) {
    const filename = path.join(folder, file);
    const stat = fs.statSync(filename);

    if (stat.isDirectory()) {
      await recursiveScan(filename, callback);
      continue;
    }

    const data = fs.readFileSync(filename, "utf8");
    await callback(filename, data);
  }
};

const parseDeclaredArgs = (rawArgs?: string) => {
  const args: string[] = [];
  const htmlArgs: string[] = [];
  const optionalArgs: string[] = [];
  const defaultArgs: Record<string, string> = {};

  for (const rawArg of rawArgs?.split(",") ?? []) {
    let arg = rawArg.trim();

    if (!arg) {
      continue;
    }

    const defaultSeparatorIndex = arg.indexOf("=");

    if (defaultSeparatorIndex !== -1) {
      const defaultValue = arg.slice(defaultSeparatorIndex + 1).trim();
      arg = arg.slice(0, defaultSeparatorIndex).trim();

      if (arg) {
        defaultArgs[arg.replace(/^[&*]/, "")] = defaultValue;
      }
    }

    if (arg.startsWith("&")) {
      const htmlArg = arg.slice(1).trim();

      if (htmlArg) {
        htmlArgs.push(htmlArg);
        args.push(htmlArg);
      }

      continue;
    }

    if (arg.startsWith("*")) {
      arg = arg.slice(1).trim();

      if (arg) {
        optionalArgs.push(arg);
        args.push(arg);
      }

      continue;
    }

    args.push(arg);
  }

  return { args, htmlArgs, optionalArgs, defaultArgs };
};

const parseComponentBlocks = (code: string): ComponentBlock[] => {
  const blocks: ComponentBlock[] = [];
  const lines = code.split("\n");

  let condition: ComponentCondition | null = null;
  let buffer: string[] = [];

  const pushBlock = () => {
    const blockCode = buffer.join("\n").trim();

    if (blockCode.length === 0) {
      return;
    }

    blocks.push({
      condition,
      code: blockCode,
    });
  };

  for (const line of lines) {
    const match = line.trim().match(/^\(([a-zA-Z0-9_-]+)=([^)]*)\)$/);

    if (match) {
      pushBlock();

      condition = {
        arg: match[1].trim(),
        value: match[2].trim(),
      };

      buffer = [];
      continue;
    }

    buffer.push(line);
  }

  pushBlock();

  return blocks;
};

const getDuplicateValues = (values: string[]) => {
  return values.filter((value, index) => {
    return values.indexOf(value) !== index;
  });
};

const getUsedArgs = (code: string) => {
  return (code.match(/\{[^}]+\}/g) ?? []).map((arg) => {
    return arg.slice(1, -1).trim();
  });
};

const getOptionalAttributeArgs = (code: string) => {
  return (code.match(/\[[a-zA-Z0-9_:-]+\]/g) ?? []).map((arg) => {
    return arg.slice(1, -1).trim();
  });
};

const validateComponent = (filename: string, component: Component) => {
  const duplicateArgs = getDuplicateValues(component.args);

  if (duplicateArgs.length > 0) {
    logWarning(
      `component:${filename}:${component.name}:duplicate-args`,
      `${bold(component.name)} declares duplicate args in ${dim(
        formatSourcePath(filename),
      )}: ${duplicateArgs.join(", ")}`,
    );
  }

  const allUsedArgs = component.blocks.flatMap((block) => {
    return getUsedArgs(block.code);
  });
  const allOptionalAttributeArgs = component.blocks.flatMap((block) => {
    return getOptionalAttributeArgs(block.code);
  });

  const conditionArgs = component.blocks
    .map((block) => block.condition?.arg)
    .filter((arg): arg is string => {
      return arg !== undefined;
    });

  const unusedArgs = component.args.filter((arg) => {
    return (
      !allUsedArgs.includes(arg) &&
      !allOptionalAttributeArgs.includes(arg) &&
      !conditionArgs.includes(arg)
    );
  });

  const referencedArgs = [...allUsedArgs, ...allOptionalAttributeArgs];

  const unknownArgs = referencedArgs.filter((arg) => {
    return !component.args.includes(arg);
  });

  const unknownConditionArgs = conditionArgs.filter((arg) => {
    return !component.args.includes(arg);
  });

  if (unusedArgs.length > 0) {
    logWarning(
      `component:${filename}:${component.name}:unused-args`,
      `${bold(component.name)} declares unused args in ${dim(
        formatSourcePath(filename),
      )}: ${unusedArgs.join(", ")}`,
    );
  }

  if (unknownArgs.length > 0) {
    logWarning(
      `component:${filename}:${component.name}:unknown-args`,
      `${bold(component.name)} references unknown args in ${dim(
        formatSourcePath(filename),
      )}: ${unknownArgs.join(", ")}`,
    );
  }

  if (unknownConditionArgs.length > 0) {
    logWarning(
      `component:${filename}:${component.name}:unknown-condition-args`,
      `${bold(component.name)} uses unknown condition args in ${dim(
        formatSourcePath(filename),
      )}: ${unknownConditionArgs.join(", ")}`,
    );
  }
};

const parseComponent = (filename: string, data: string) => {
  const [header = "", ...rest] = data.split("\n");
  const code = rest.join("\n");

  const match = header.trim().match(/^\[component:([^;\]]+)(?:;([^\]]+))?\]$/);

  if (!match) {
    logWarning(
      `component:${filename}:invalid-header`,
      `Invalid component header in ${dim(formatSourcePath(filename))}: ${header}`,
    );
    return;
  }

  const blocks = parseComponentBlocks(code);
  const component: Component = {
    name: match[1].trim(),
    sourceFile: filename,
    ...parseDeclaredArgs(match[2]),
    optionalAttributeArgs: blocks.flatMap((block) => {
      return getOptionalAttributeArgs(block.code);
    }),
    blocks,
  };

  validateComponent(filename, component);
  components.push(component);
};

const getComponentSourceName = (component: Component) => {
  return path.basename(component.sourceFile, ".html");
};

const getComponentCssFile = (component: Component) => {
  return path.join(
    publicFolder,
    "assets",
    "styles",
    "components",
    `${getComponentSourceName(component)}.css`,
  );
};

const isGlobalStylesheet = (filename: string, data: string) => {
  if (path.basename(filename) === "main.css") {
    return true;
  }

  return data.trimStart().startsWith("/* global */");
};

const getLinkedStylesheets = (htmlFile: string, html: string) => {
  const stylesheets: string[] = [];

  for (const match of html.matchAll(/<link\b([^>]*?)>/gi)) {
    const attrs = parseAttributes(match[1]);

    if ((attrs.rel ?? "").toLowerCase() !== "stylesheet" || !attrs.href) {
      continue;
    }

    if (isExternalImage(attrs.href)) {
      continue;
    }

    const sourceFile = resolvePublicAsset(htmlFile, attrs.href);

    if (
      !sourceFile ||
      !fs.existsSync(sourceFile) ||
      !fs.statSync(sourceFile).isFile()
    ) {
      continue;
    }

    if (path.extname(sourceFile).toLowerCase() !== ".css") {
      continue;
    }

    stylesheets.push(sourceFile);
  }

  return stylesheets;
};

const getComponentNamesFromHtml = (html: string) => {
  const componentNames: string[] = [];

  for (const match of html.matchAll(/<misaliba-([a-zA-Z0-9_-]+)\b/gi)) {
    componentNames.push(match[1]);
  }

  return componentNames;
};

const collectComponentClosure = (html: string) => {
  const queue = [...getComponentNamesFromHtml(html)];
  const seen = new Set<string>();
  const collected: Component[] = [];

  while (queue.length > 0) {
    const componentName = queue.shift() ?? "";

    if (!componentName || seen.has(componentName)) {
      continue;
    }

    seen.add(componentName);

    const component = components.find((entry) => {
      return entry.name === componentName;
    });

    if (!component) {
      continue;
    }

    collected.push(component);

    const nestedSource = component.blocks
      .map((block) => {
        return block.code;
      })
      .join("\n");

    for (const nestedName of getComponentNamesFromHtml(nestedSource)) {
      queue.push(nestedName);
    }
  }

  return collected;
};

const collectPageStylesheetComponentCssFiles = async () => {
  pageStylesheetComponentCssFiles.clear();

  await recursiveScan(publicFolder, (filename, data) => {
    if (!filename.endsWith(".html")) {
      return;
    }

    const localStylesheets = getLinkedStylesheets(filename, data).filter(
      (stylesheet) => {
        return !isGlobalStylesheet(
          stylesheet,
          fs.readFileSync(stylesheet, "utf8"),
        );
      },
    );

    const pageStylesheet = localStylesheets[0];

    if (!pageStylesheet) {
      return;
    }

    const componentCssFiles =
      pageStylesheetComponentCssFiles.get(pageStylesheet) ?? new Set<string>();

    for (const component of collectComponentClosure(data)) {
      const componentCssFile = getComponentCssFile(component);

      if (
        !fs.existsSync(componentCssFile) ||
        !fs.statSync(componentCssFile).isFile()
      ) {
        continue;
      }

      componentCssFiles.add(componentCssFile);
    }

    if (componentCssFiles.size > 0) {
      pageStylesheetComponentCssFiles.set(pageStylesheet, componentCssFiles);
    }
  });
};

const bundlePageStylesheet = (sourceFile: string, data: string) => {
  const componentCssFiles = pageStylesheetComponentCssFiles.get(sourceFile);

  if (!componentCssFiles || componentCssFiles.size === 0) {
    return data;
  }

  const componentCss = [...componentCssFiles]
    .map((componentCssFile) => {
      return fs.readFileSync(componentCssFile, "utf8").trim();
    })
    .filter((css) => {
      return css.length > 0;
    })
    .join("\n\n");

  if (componentCss.length === 0) {
    return data;
  }

  const pageCss = data.trim();

  return pageCss.length > 0 ? `${componentCss}\n\n${pageCss}` : componentCss;
};

const parseUsageArgs = (rawArgs: string) => {
  return parseAttributes(rawArgs);
};

const getRequiredComponentArgs = (component: Component) => {
  return component.args.filter((arg) => {
    return (
      !component.htmlArgs.includes(arg) &&
      !component.optionalArgs.includes(arg) &&
      !Object.prototype.hasOwnProperty.call(component.defaultArgs, arg)
    );
  });
};

const warnAboutUsageArgs = (
  component: Component,
  args: Record<string, string>,
  sourceFile: string | null,
  sourceData: string | null,
  offset: number | null,
) => {
  if (!sourceFile || !isInsideFolder(publicFolder, sourceFile)) {
    return;
  }

  const missingArgs = getRequiredComponentArgs(component).filter((arg) => {
    return !Object.prototype.hasOwnProperty.call(args, arg) || args[arg] === "";
  });
  const unknownArgs = Object.keys(args).filter((arg) => {
    return !component.args.includes(arg);
  });

  if (missingArgs.length === 0 && unknownArgs.length === 0) {
    return;
  }

  const line =
    sourceData === null || offset === null
      ? null
      : sourceLineFromOffset(sourceData, offset);
  const location = `${formatSourcePath(sourceFile)}${line ? `:${line}` : ""}`;
  const tagName = `<${componentPrefix}-${component.name}>`;

  if (missingArgs.length > 0) {
    logWarning(
      `usage:${sourceFile}:${offset}:${component.name}:missing:${missingArgs.join(",")}`,
      `${bold(tagName)} is missing required args in ${dim(
        location,
      )} ${yellow("missing args")}: ${missingArgs.join(", ")}`,
    );
  }

  if (unknownArgs.length > 0) {
    logWarning(
      `usage:${sourceFile}:${offset}:${component.name}:unknown:${unknownArgs.join(",")}`,
      `${bold(tagName)} has unknown args in ${dim(location)} ${yellow(
        "unknown args",
      )}: ${unknownArgs.join(", ")}`,
    );
  }
};

const sourceLineFromOffset = (data: string, offset: number) => {
  return data.slice(0, offset).split("\n").length;
};

const reportUnresolvedComponentUsage = (
  componentName: string,
  sourceFile: string | null,
  data: string,
  offset: number | null,
  context: string,
) => {
  const tagName = `<${componentPrefix}-${componentName}>`;
  const location =
    sourceFile && offset !== null
      ? `${formatSourcePath(sourceFile)}:${sourceLineFromOffset(data, offset)}`
      : sourceFile
        ? formatSourcePath(sourceFile)
        : "unknown source";

  logErrorOnce(
    `unresolved-component:${context}:${sourceFile ?? "unknown"}:${offset ?? "unknown"}:${componentName}`,
    `${bold(tagName)} could not be resolved in ${dim(location)} during ${context}.`,
  );
};

const reportUnresolvedComponentsInHtml = (
  data: string,
  sourceFile: string | null,
  context: string,
  options: {
    knownOnly?: boolean;
  } = {},
) => {
  for (const match of data.matchAll(/<misaliba-([a-zA-Z0-9_-]+)\b/gi)) {
    const componentName = match[1];
    const component = components.find((entry) => {
      return entry.name === componentName;
    });

    if (component && !options.knownOnly) {
      continue;
    }

    reportUnresolvedComponentUsage(
      componentName,
      sourceFile,
      data,
      match.index ?? null,
      context,
    );
  }
};

const validatePublicComponentUsages = (sourceFile: string, data: string) => {
  if (!isInsideFolder(publicFolder, sourceFile)) {
    return;
  }

  for (const match of data.matchAll(/<misaliba-([a-zA-Z0-9_-]+)\b([^>]*)>/gi)) {
    const componentName = match[1];
    const rawArgs = match[2] ?? "";
    const offset = match.index ?? null;
    const component = components.find((entry) => {
      return entry.name === componentName;
    });

    if (!component) {
      reportUnresolvedComponentUsage(
        componentName,
        sourceFile,
        data,
        offset,
        "public HTML validation",
      );
      continue;
    }

    warnAboutUsageArgs(
      component,
      parseUsageArgs(rawArgs),
      sourceFile,
      data,
      offset,
    );
  }
};

const renderOptionalAttributes = (
  code: string,
  args: Record<string, string>,
) => {
  return code.replace(
    /\s*\[([a-zA-Z0-9_:-]+)\]/g,
    (_match, argName: string) => {
      const value = args[argName];

      if (value === undefined || value === "" || value === "false") {
        return "";
      }

      return ` ${argName}="${escapeAttributeValue(value)}"`;
    },
  );
};

const booleanHtmlAttributes = new Set([
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "formnovalidate",
  "hidden",
  "inert",
  "ismap",
  "itemscope",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "selected",
]);

const renderBooleanPlaceholderAttributes = (
  code: string,
  args: Record<string, string>,
) => {
  return code.replace(
    /\s+([a-zA-Z0-9_:-]+)=["']\{([^}]+)\}["']/g,
    (match, attrName: string, argName: string) => {
      if (!booleanHtmlAttributes.has(attrName.toLowerCase())) {
        return match;
      }

      const value = args[argName.trim()];

      if (value === undefined || value === "" || value === "false") {
        return "";
      }

      return ` ${attrName}`;
    },
  );
};

const renderBooleanLiteralAttributes = (code: string) => {
  return code.replace(
    /\s+([a-zA-Z0-9_:-]+)=["']([^"']*)["']/g,
    (match, attrName: string, value: string) => {
      if (!booleanHtmlAttributes.has(attrName.toLowerCase())) {
        return match;
      }

      if (value === "" || value === "false") {
        return "";
      }

      if (value === "true" || value === attrName) {
        return ` ${attrName}`;
      }

      return match;
    },
  );
};

const renderComponent = (
  component: Component,
  args: Record<string, string>,
  depth = 0,
  innerHtml = "",
  sourceFile: string | null = null,
): string => {
  if (depth > 50) {
    logWarning(
      `component:${component.name}:max-depth`,
      `Max render depth reached in ${bold(
        component.name,
      )}. Possible recursive component call.`,
    );
    return "";
  }

  const resolvedArgs = {
    ...component.defaultArgs,
    ...args,
  };

  const selectedBlock =
    component.blocks.find((block) => {
      return (
        block.condition !== null &&
        resolvedArgs[block.condition.arg] === block.condition.value
      );
    }) ??
    component.blocks.find((block) => {
      return block.condition === null;
    }) ??
    component.blocks[0];

  if (!selectedBlock) {
    return "";
  }

  for (const htmlArg of component.htmlArgs) {
    if (
      innerHtml.trim().length > 0 ||
      !Object.prototype.hasOwnProperty.call(resolvedArgs, htmlArg)
    ) {
      resolvedArgs[htmlArg] = innerHtml;
    }
  }

  const interpolatedCode = renderBooleanPlaceholderAttributes(
    renderOptionalAttributes(selectedBlock.code, resolvedArgs),
    resolvedArgs,
  ).replace(/\{([^}]+)\}/g, (_match, argName: string) => {
    return resolvedArgs[argName.trim()] ?? "";
  });
  const renderedCode = renderBooleanLiteralAttributes(interpolatedCode);

  return transpileHtml(renderedCode, depth + 1, sourceFile);
};

const transpileHtml = (
  data: string,
  depth = 0,
  sourceFile: string | null = null,
) => {
  let output = data;

  for (const component of components) {
    const tagName = `${componentPrefix}-${component.name}`;

    const pairedTagRegex = new RegExp(
      `<${tagName}\\s*([^>]*)>([\\s\\S]*?)</${tagName}\\s*>`,
      "g",
    );

    const selfClosingTagRegex = new RegExp(`<${tagName}\\s*([^>]*)\\s*/>`, "g");

    const renderTag = (
      _match: string,
      rawArgs: string,
      innerHtml = "",
      offset: number | null = null,
    ) => {
      const args = parseUsageArgs(rawArgs);
      return renderComponent(component, args, depth, innerHtml, sourceFile);
    };

    output = output.replace(
      pairedTagRegex,
      (match, rawArgs, innerHtml, offset) => {
        return renderTag(match, rawArgs, innerHtml, offset);
      },
    );
    output = output.replace(selfClosingTagRegex, (match, rawArgs, offset) => {
      return renderTag(match, rawArgs, "", offset);
    });
  }

  if (depth === 0) {
    reportUnresolvedComponentsInHtml(output, sourceFile, "HTML transpile", {
      knownOnly: true,
    });
  }

  return output;
};

const getDistPath = (sourceFile: string) => {
  const relativePath = path.relative(publicFolder, sourceFile);
  return path.join(distFolder, relativePath);
};

const ensureOutputFolder = (outputFile: string) => {
  fs.mkdirSync(path.dirname(outputFile), {
    recursive: true,
  });
};

const toHtmlRelativePath = (htmlFile: string, targetFile: string) => {
  const htmlOutputFile = getDistPath(htmlFile);
  const htmlOutputFolder = path.dirname(htmlOutputFile);

  return path.relative(htmlOutputFolder, targetFile).replaceAll(path.sep, "/");
};

const toRelativeOutputPath = (htmlFile: string, targetPath: string) => {
  const htmlOutputFile = getDistPath(htmlFile);
  const htmlOutputFolder = path.dirname(htmlOutputFile);
  const relativePath = path.relative(
    htmlOutputFolder,
    path.join(distFolder, targetPath),
  );

  if (relativePath.length === 0) {
    return ".";
  }

  const normalizedPath = relativePath.replaceAll(path.sep, "/");

  return normalizedPath.startsWith(".")
    ? normalizedPath
    : `./${normalizedPath}`;
};

const toPublicOutputPath = (htmlFile: string, targetPath: string) => {
  const normalizedPath = targetPath.replaceAll(path.sep, "/");

  if (siteUrl) {
    return `${siteUrl.href}/${normalizedPath.replace(/^\/+/, "")}`;
  }

  return toRelativeOutputPath(htmlFile, normalizedPath);
};

const toPublicOutputFilePath = (htmlFile: string, targetFile: string) => {
  const relativePath = path.relative(distFolder, targetFile);

  return toPublicOutputPath(htmlFile, relativePath);
};

const getConfiguredSitePathname = (value: string) => {
  if (!siteUrl) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.origin !== siteUrl.origin) {
      return null;
    }

    if (!siteUrl.basePath) {
      return url.pathname;
    }

    if (url.pathname === siteUrl.basePath) {
      return "/";
    }

    if (url.pathname.startsWith(`${siteUrl.basePath}/`)) {
      return url.pathname.slice(siteUrl.basePath.length);
    }

    return null;
  } catch {
    return null;
  }
};

const getLocalPublicPathname = (value: string) => {
  const sameSitePathname = getConfiguredSitePathname(value);

  if (sameSitePathname) {
    return sameSitePathname;
  }

  const cleanValue = value.split("?")[0].split("#")[0];

  if (!cleanValue.startsWith("/") || cleanValue.startsWith("//")) {
    return null;
  }

  return cleanValue;
};

const rewriteLocalPublicUrls = (htmlFile: string, html: string) => {
  return html.replace(
    /(href|src|poster|action|content)=("|')([^"']+)(\2)/g,
    (fullMatch, attributeName: string, quote: string, rawUrl: string) => {
      const localPathname = getLocalPublicPathname(rawUrl);

      if (
        !localPathname ||
        localPathname === "/" ||
        localPathname.startsWith("/api/")
      ) {
        return fullMatch;
      }

      const publicPath = path.join(publicFolder, localPathname.slice(1));

      if (!fs.existsSync(publicPath) || !fs.statSync(publicPath).isFile()) {
        return fullMatch;
      }

      const ext = path.extname(publicPath).toLowerCase();

      if (ext === ".html") {
        return fullMatch;
      }

      const relativeOutputPath = toPublicOutputPath(
        htmlFile,
        localPathname.slice(1),
      );

      return `${attributeName}=${quote}${relativeOutputPath}${quote}`;
    },
  );
};

const isLocalGeneratedStylesheet = (htmlFile: string, href: string) => {
  const sourceFile = resolvePublicAsset(htmlFile, href);

  if (!sourceFile) {
    return false;
  }

  const relativePath = getPublicRelativePath(sourceFile);

  return (
    relativePath === "assets/styles/main.css" ||
    (relativePath.startsWith("assets/styles/") &&
      path.extname(relativePath).toLowerCase() === ".css")
  );
};

const rewriteLocalStylesheetLinks = (htmlFile: string, html: string) => {
  let hasMainStylesheet = false;

  const rewrittenHtml = html.replace(
    /<link\b([^>]*?)>/gi,
    (fullTag, rawAttributes: string) => {
      const attrs = parseAttributes(rawAttributes);

      if ((attrs.rel ?? "").toLowerCase() !== "stylesheet" || !attrs.href) {
        return fullTag;
      }

      if (!isLocalGeneratedStylesheet(htmlFile, attrs.href)) {
        return fullTag;
      }

      const stylesheetHref = toPublicOutputPath(
        htmlFile,
        "assets/styles/main.css",
      );

      if (hasMainStylesheet) {
        return "";
      }

      hasMainStylesheet = true;
      return replaceAttribute(fullTag, "href", stylesheetHref);
    },
  );

  return rewrittenHtml;
};

const normalizePublicPath = (value: string) => {
  return value.split("?")[0].split("#")[0];
};

const isExternalImage = (src: string) => {
  if (getConfiguredSitePathname(src)) {
    return false;
  }

  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("//") ||
    src.startsWith("data:") ||
    src.startsWith("blob:")
  );
};

const resolvePublicAsset = (htmlFile: string, src: string) => {
  const cleanSrc = normalizePublicPath(src);
  const localPathname = getLocalPublicPathname(src);

  if (localPathname) {
    return path.join(publicFolder, localPathname.slice(1));
  }

  if (isExternalImage(cleanSrc)) {
    return null;
  }

  return path.resolve(path.dirname(htmlFile), cleanSrc);
};

const isOptimizableImage = (filename: string) => {
  return imageExtensions.includes(path.extname(filename).toLowerCase());
};

const isPassthroughImage = (filename: string) => {
  return passthroughImageExtensions.includes(
    path.extname(filename).toLowerCase(),
  );
};

const getImageDimensions = (filename: string) => {
  try {
    const output = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=s=x:p=0",
        filename,
      ],
      {
        encoding: "utf8",
      },
    ).trim();

    const [width, height] = output.split("x").map(Number);

    if (!width || !height) {
      return null;
    }

    return {
      width,
      height,
    };
  } catch {
    return null;
  }
};

const parseAttributes = (rawAttributes: string) => {
  const attrs: Record<string, string> = {};
  const matches = rawAttributes.matchAll(
    /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+)))?/g,
  );

  for (const match of matches) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
  }

  return attrs;
};

const replaceAttribute = (tag: string, name: string, value: string) => {
  const escapedValue = value.replace(/"/g, "&quot;");
  const regex = new RegExp(`\\s${name}="[^"]*"`, "i");

  if (regex.test(tag)) {
    return tag.replace(regex, ` ${name}="${escapedValue}"`);
  }

  return tag.replace(/\/?>$/, ` ${name}="${escapedValue}"$&`);
};

const removeAttribute = (tag: string, name: string) => {
  const regex = new RegExp(`\\s${name}="[^"]*"`, "i");
  return tag.replace(regex, "");
};

const parseCssLengthValue = (
  value: string,
): {
  kind: "px" | "percent" | "vw" | "auto" | "unknown";
  value: number | null;
} => {
  const cleanValue = value.trim();

  if (cleanValue === "auto") {
    return { kind: "auto", value: null };
  }

  const pxMatch = cleanValue.match(/^([0-9.]+)px$/);

  if (pxMatch) {
    return { kind: "px", value: Math.ceil(Number(pxMatch[1])) };
  }

  const remMatch = cleanValue.match(/^([0-9.]+)rem$/);

  if (remMatch) {
    return { kind: "px", value: Math.ceil(Number(remMatch[1]) * 16) };
  }

  const vwMatch = cleanValue.match(/^([0-9.]+)vw$/);

  if (vwMatch) {
    return { kind: "vw", value: Number(vwMatch[1]) };
  }

  const percentMatch = cleanValue.match(/^([0-9.]+)%$/);

  if (percentMatch) {
    return { kind: "percent", value: Number(percentMatch[1]) };
  }

  return { kind: "unknown", value: null };
};

const parseCssDeclarations = (body: string) => {
  const declarations: Record<string, string> = {};
  const matches = body.matchAll(/([a-zA-Z-]+)\s*:\s*([^;]+)(?:;|$)/g);

  for (const match of matches) {
    declarations[match[1].trim().toLowerCase()] = match[2].trim();
  }

  return declarations;
};

const stripCssComments = (css: string) => {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
};

const findMatchingBrace = (css: string, openIndex: number) => {
  let depth = 0;

  for (let index = openIndex; index < css.length; index += 1) {
    const char = css[index];

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
};

const getSelectorSpecificity = (selector: string) => {
  const selectorParts = selector.split(/\s+|>|\+|~/).filter(Boolean);

  return selectorParts.reduce((score, part) => {
    const idCount = part.match(/#[a-zA-Z0-9_-]+/g)?.length ?? 0;
    const classCount = part.match(/\.[a-zA-Z0-9_-]+/g)?.length ?? 0;
    const attributeCount = part.match(/\[[^\]]+\]/g)?.length ?? 0;
    const tagCount = /^[a-zA-Z][a-zA-Z0-9-]*/.test(part) ? 1 : 0;

    return (
      score + idCount * 100 + (classCount + attributeCount) * 10 + tagCount
    );
  }, 0);
};

const parseCssRules = (
  css: string,
  mediaConditions: string[] = [],
  startOrder = 0,
) => {
  const rules: CssImageRule[] = [];
  const cleanCss = stripCssComments(css);
  let index = 0;
  let order = startOrder;

  while (index < cleanCss.length) {
    while (/\s/.test(cleanCss[index] ?? "")) {
      index += 1;
    }

    if (index >= cleanCss.length) {
      break;
    }

    if (cleanCss.startsWith("@media", index)) {
      const openBraceIndex = cleanCss.indexOf("{", index);

      if (openBraceIndex === -1) {
        break;
      }

      const closeBraceIndex = findMatchingBrace(cleanCss, openBraceIndex);

      if (closeBraceIndex === -1) {
        break;
      }

      const mediaCondition = cleanCss.slice(index + 6, openBraceIndex).trim();
      const innerCss = cleanCss.slice(openBraceIndex + 1, closeBraceIndex);
      const parsed = parseCssRules(
        innerCss,
        [...mediaConditions, mediaCondition],
        order,
      );

      rules.push(...parsed.rules);
      order = parsed.nextOrder;
      index = closeBraceIndex + 1;
      continue;
    }

    if (cleanCss[index] === "@") {
      const semicolonIndex = cleanCss.indexOf(";", index);
      const openBraceIndex = cleanCss.indexOf("{", index);

      if (
        openBraceIndex !== -1 &&
        (semicolonIndex === -1 || openBraceIndex < semicolonIndex)
      ) {
        const closeBraceIndex = findMatchingBrace(cleanCss, openBraceIndex);

        if (closeBraceIndex === -1) {
          break;
        }

        const innerCss = cleanCss.slice(openBraceIndex + 1, closeBraceIndex);
        const parsed = parseCssRules(innerCss, mediaConditions, order);

        rules.push(...parsed.rules);
        order = parsed.nextOrder;
        index = closeBraceIndex + 1;
        continue;
      }

      index = semicolonIndex === -1 ? cleanCss.length : semicolonIndex + 1;
      continue;
    }

    const openBraceIndex = cleanCss.indexOf("{", index);

    if (openBraceIndex === -1) {
      break;
    }

    const closeBraceIndex = findMatchingBrace(cleanCss, openBraceIndex);

    if (closeBraceIndex === -1) {
      break;
    }

    const selectorText = cleanCss.slice(index, openBraceIndex).trim();
    const body = cleanCss.slice(openBraceIndex + 1, closeBraceIndex).trim();

    index = closeBraceIndex + 1;

    if (!selectorText || !body) {
      continue;
    }

    const declarations = parseCssDeclarations(body);

    for (const selector of selectorText
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)) {
      rules.push({
        selector,
        declarations,
        specificity: getSelectorSpecificity(selector),
        order: order,
        mediaConditions: [...mediaConditions],
      });

      order += 1;
    }
  }

  return {
    rules,
    nextOrder: order,
  };
};

const loadCssImageRules = async () => {
  cssImageRules.length = 0;

  let order = 0;

  await recursiveScan(publicFolder, (filename, data) => {
    if (!filename.endsWith(".css")) {
      return;
    }

    const parsed = parseCssRules(data, [], order);

    cssImageRules.push(...parsed.rules);
    order = parsed.nextOrder;
  });
};

const selectorMatchesImage = (
  selector: string,
  attrs: Record<string, string>,
) => {
  return selectorMatchesElement(selector, attrs, "img");
};

const selectorMatchesElement = (
  selector: string,
  attrs: Record<string, string>,
  tagName: string,
) => {
  const cleanSelector = selector.trim();
  const lastSelectorPart =
    cleanSelector
      .split(/\s+|>|\+|~/)
      .filter(Boolean)
      .at(-1) ?? cleanSelector;

  const id = attrs.id ?? "";
  const classes = (attrs.class ?? "")
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const tagMatch = lastSelectorPart.match(/^[a-zA-Z][a-zA-Z0-9-]*/);

  if (tagMatch && tagMatch[0] !== tagName) {
    return false;
  }

  const idMatch = lastSelectorPart.match(/#([a-zA-Z0-9_-]+)/);

  if (idMatch && id !== idMatch[1]) {
    return false;
  }

  const classMatches = [
    ...lastSelectorPart.matchAll(/\.([a-zA-Z0-9_-]+)/g),
  ].map((match) => {
    return match[1];
  });

  if (classMatches.length > 0) {
    return classMatches.every((className) => {
      return classes.includes(className);
    });
  }

  if (idMatch) {
    return true;
  }

  return lastSelectorPart === tagName;
};

const voidHtmlElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const getHtmlAncestorStack = (html: string, offset: number) => {
  const ancestors: HtmlElementContext[] = [];
  const scanner = /<!--([\s\S]*?)-->|<\/?[a-zA-Z][^>]*>/g;
  const source = html.slice(0, offset);

  for (const match of source.matchAll(scanner)) {
    const token = match[0];

    if (token.startsWith("<!--")) {
      continue;
    }

    const isClosingTag = token.startsWith("</");
    const tagMatch = token.match(/^<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/);

    if (!tagMatch) {
      continue;
    }

    const tagName = tagMatch[1].toLowerCase();

    if (isClosingTag) {
      for (let index = ancestors.length - 1; index >= 0; index -= 1) {
        if (ancestors[index].tagName === tagName) {
          ancestors.splice(index);
          break;
        }
      }

      continue;
    }

    const selfClosing = token.endsWith("/>") || voidHtmlElements.has(tagName);

    if (selfClosing) {
      continue;
    }

    const rawAttributes = tagMatch[2].replace(/\/$/, "").trim();

    ancestors.push({
      tagName,
      attrs: parseAttributes(rawAttributes),
    });
  }

  return ancestors;
};

const parseInlineStyle = (style: string) => {
  return parseCssDeclarations(style);
};

const isWinningDeclaration = (
  candidate: { specificity: number; order: number },
  current: { specificity: number; order: number } | null,
) => {
  if (!current) {
    return true;
  }

  if (candidate.specificity !== current.specificity) {
    return candidate.specificity > current.specificity;
  }

  return candidate.order >= current.order;
};

const buildSizesFromLayout = (layout: ImageLayout) => {
  if (layout.kind === "fixed" && layout.fixedWidth !== null) {
    return `${layout.fixedWidth}px`;
  }

  if (layout.maxWidth !== null) {
    return `(max-width: ${layout.maxWidth}px) 100vw, ${layout.maxWidth}px`;
  }

  return "100vw";
};

const normalizeRoutePath = (pathname: string) => {
  const cleanPath = pathname.replace(/\/+$/g, "");

  if (cleanPath.length === 0) {
    return "/";
  }

  if (cleanPath === "/") {
    return "/";
  }

  return cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
};

const getHtmlRouteFromOutputFile = (outputFile: string) => {
  const relativePath = path
    .relative(distFolder, outputFile)
    .replaceAll(path.sep, "/");

  if (relativePath === "index.html") {
    return "/";
  }

  if (relativePath.endsWith("/index.html")) {
    return normalizeRoutePath(
      `/${relativePath.slice(0, -"/index.html".length)}`,
    );
  }

  if (relativePath.endsWith(".html")) {
    return normalizeRoutePath(`/${relativePath.slice(0, -".html".length)}`);
  }

  return null;
};

const createLiveReloadScript = (route: string) => {
  return `<script>
(() => {
  const route = ${JSON.stringify(route)};
  const replaceDocument = (html) => {
    document.open();
    document.write(html);
    document.close();
  };

  const updateStylesheets = (href) => {
    const targetPath = new URL(href, location.href).pathname;
    let updated = false;

    document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      const currentPath = new URL(link.href, location.href).pathname;

      if (currentPath !== targetPath) {
        return;
      }

      const rawHref = link.getAttribute("href") ?? link.href;
      const baseHref = rawHref.split("?")[0];
      link.href = baseHref + "?v=" + Date.now();
      updated = true;
    });

    if (!updated) {
      location.reload();
    }
  };

  const connect = () => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(protocol + "//" + location.host + "/__live?route=" + encodeURIComponent(route));

    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "html-update" && typeof data.html === "string") {
          replaceDocument(data.html);
          return;
        }

        if (data.type === "css-update" && typeof data.href === "string") {
          updateStylesheets(data.href);
          return;
        }

        if (data.type === "reload") {
          location.reload();
        }
      } catch {
        location.reload();
      }
    });

    socket.addEventListener("close", () => {
      setTimeout(connect, 1000);
    });
  };

  connect();
})();
</script>`;
};

const injectLiveReloadScript = (html: string, route: string) => {
  const script = createLiveReloadScript(route);

  if (html.includes("</body>")) {
    return html.replace("</body>", `${script}</body>`);
  }

  if (html.includes("</html>")) {
    return html.replace("</html>", `${script}</html>`);
  }

  return `${html}${script}`;
};

const renderNotFoundPage = (route: string) => {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>404</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0c0c0f;
        color: #ffffff;
        font-family: sans-serif;
      }
      main {
        text-align: center;
        padding: 2rem;
      }
      p {
        opacity: 0.8;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>404</h1>
      <p>This route is not built yet.</p>
      <p>Waiting for updates on ${route}</p>
    </main>
    ${createLiveReloadScript(route)}
  </body>
</html>`;
};

const getContentType = (filename: string) => {
  switch (path.extname(filename).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
    case ".webmanifest":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".avif":
      return "image/avif";
    case ".gif":
      return "image/gif";
    case ".ico":
      return "image/x-icon";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
};

const getPublicHref = (filename: string) => {
  const relativePath = path
    .relative(publicFolder, filename)
    .replaceAll(path.sep, "/");
  return `/${relativePath}`;
};

const getPublicRelativePath = (filename: string) => {
  return path.relative(publicFolder, filename).replaceAll(path.sep, "/");
};

const getStylesheetLayer = (rawName: string): StylesheetLayerName | null => {
  const cleanName = rawName.trim().toLowerCase();

  for (const layer of stylesheetLayers) {
    if (layer.aliases.includes(cleanName)) {
      return layer.name;
    }
  }

  return null;
};

const resetStylesheetLayers = () => {
  stylesheetLayerChunks.clear();

  for (const layer of stylesheetLayers) {
    stylesheetLayerChunks.set(layer.name, []);
  }
};

const pushStylesheetLayerChunk = (
  layerName: StylesheetLayerName,
  css: string,
) => {
  const cleanCss = css.trim();

  if (cleanCss.length === 0) {
    return;
  }

  const chunks = stylesheetLayerChunks.get(layerName) ?? [];

  chunks.push(cleanCss);
  stylesheetLayerChunks.set(layerName, chunks);
};

const getLayerStatementEndIndex = (css: string, startIndex: number) => {
  const openBraceIndex = css.indexOf("{", startIndex);
  const semicolonIndex = css.indexOf(";", startIndex);

  if (
    semicolonIndex !== -1 &&
    (openBraceIndex === -1 || semicolonIndex < openBraceIndex)
  ) {
    return {
      kind: "statement" as const,
      endIndex: semicolonIndex,
    };
  }

  if (openBraceIndex === -1) {
    return null;
  }

  const closeBraceIndex = findMatchingBrace(css, openBraceIndex);

  if (closeBraceIndex === -1) {
    return null;
  }

  return {
    kind: "block" as const,
    openBraceIndex,
    closeBraceIndex,
  };
};

const collectStylesheetLayerCss = (
  css: string,
  fallbackLayer: StylesheetLayerName,
  currentLayer: StylesheetLayerName | null = null,
) => {
  let index = 0;
  let buffer = "";

  while (index < css.length) {
    const layerIndex = css.indexOf("@layer", index);

    if (layerIndex === -1) {
      buffer += css.slice(index);
      break;
    }

    const beforeLayer = css[layerIndex - 1] ?? "";
    const afterLayer = css[layerIndex + "@layer".length] ?? "";

    if (
      /[a-zA-Z0-9_-]/.test(beforeLayer) ||
      /[a-zA-Z0-9_-]/.test(afterLayer)
    ) {
      buffer += css.slice(index, layerIndex + "@layer".length);
      index = layerIndex + "@layer".length;
      continue;
    }

    buffer += css.slice(index, layerIndex);

    const layerStatement = getLayerStatementEndIndex(css, layerIndex);

    if (!layerStatement) {
      buffer += css.slice(layerIndex);
      break;
    }

    if (layerStatement.kind === "statement") {
      buffer = "";
      index = layerStatement.endIndex + 1;
      continue;
    }

    const prelude = css
      .slice(layerIndex + "@layer".length, layerStatement.openBraceIndex)
      .trim();
    const layerName =
      getStylesheetLayer(prelude.split(",")[0]?.trim() ?? "") ??
      currentLayer ??
      fallbackLayer;
    const blockCss = css.slice(
      layerStatement.openBraceIndex + 1,
      layerStatement.closeBraceIndex,
    );

    pushStylesheetLayerChunk(currentLayer ?? layerName, buffer);
    buffer = "";
    collectStylesheetLayerCss(blockCss, layerName, layerName);
    index = layerStatement.closeBraceIndex + 1;
  }

  pushStylesheetLayerChunk(currentLayer ?? fallbackLayer, buffer);
};

const collectStylesheetFile = (sourceFile: string, data: string) => {
  const relativePath = getPublicRelativePath(sourceFile);
  const fallbackLayer: StylesheetLayerName = relativePath.includes(
    "/utilities/",
  )
    ? "utilities"
    : relativePath.includes("/layout/")
      ? "layout"
      : relativePath.includes("/typography/")
        ? "typography"
        : relativePath.includes("/base/")
          ? "base"
          : "components";

  collectStylesheetLayerCss(data, fallbackLayer);
};

const createStylesheetLayerFile = (
  layerName: StylesheetLayerName,
  chunks: string[],
) => {
  const body = chunks
    .map((chunk) => {
      return chunk.trim();
    })
    .filter(Boolean)
    .join("\n\n");

  return body.length > 0 ? `@layer ${layerName} {\n${body}\n}\n` : "";
};

const createMainStylesheet = () => {
  return [
    `@layer ${stylesheetLayers.map((layer) => layer.name).join(", ")};`,
    ...stylesheetLayers.map((layer) => {
      return `@import url("./${layer.filename}");`;
    }),
  ].join("\n");
};

const emitGeneratedStylesheets = async () => {
  ensureOutputFolder(path.join(generatedStylesFolder, "main.css"));

  const mainCss = `${createMainStylesheet()}\n`;
  const formattedMainCss = await format(mainCss, {
    parser: "css",
  });
  const mainFile = path.join(generatedStylesFolder, "main.css");

  fs.writeFileSync(mainFile, formattedMainCss);

  const mainSnapshotKey = "assets/styles/main.css";

  if (emittedStylesheetSnapshots.get(mainSnapshotKey) !== formattedMainCss) {
    currentBuildCssUpdates.add("/assets/styles/main.css");
  }

  emittedStylesheetSnapshots.set(mainSnapshotKey, formattedMainCss);

  for (const layer of stylesheetLayers) {
    const chunks = stylesheetLayerChunks.get(layer.name) ?? [];
    const css = createStylesheetLayerFile(layer.name, chunks);
    const formattedCss =
      css.trim().length > 0
        ? await format(css, {
            parser: "css",
          })
        : `@layer ${layer.name} {\n}\n`;
    const outputFile = path.join(generatedStylesFolder, layer.filename);
    const snapshotKey = `assets/styles/${layer.filename}`;

    fs.writeFileSync(outputFile, formattedCss);

    if (emittedStylesheetSnapshots.get(snapshotKey) !== formattedCss) {
      currentBuildCssUpdates.add(`/assets/styles/${layer.filename}`);
    }

    emittedStylesheetSnapshots.set(snapshotKey, formattedCss);
  }
};

const recordPublicAssetChange = (filename: string, data: string) => {
  const relativePath = getPublicRelativePath(filename);
  currentBuildSeenPublicFiles.add(relativePath);

  const previousSnapshot = publicFileSnapshots.get(relativePath);

  if (previousSnapshot === data) {
    return;
  }

  publicFileSnapshots.set(relativePath, data);

  if (filename.endsWith(".css")) {
    return;
  }

  if (filename.endsWith(".js")) {
    currentBuildReloadAll = true;
  }
};

const resolveDistFile = (pathname: string) => {
  const cleanPath = decodeURIComponent(pathname);
  const normalizedPath = normalizeRoutePath(cleanPath);
  const candidates: string[] = [];

  if (normalizedPath === "/") {
    candidates.push(path.join(distFolder, "index.html"));
  } else {
    const relativePath = normalizedPath.slice(1);
    candidates.push(path.join(distFolder, relativePath));

    if (!path.extname(relativePath)) {
      candidates.push(path.join(distFolder, `${relativePath}.html`));
      candidates.push(path.join(distFolder, relativePath, "index.html"));
    }
  }

  for (const candidate of candidates) {
    const resolvedCandidate = path.resolve(candidate);
    const distRoot = path.resolve(distFolder);

    if (!resolvedCandidate.startsWith(distRoot)) {
      continue;
    }

    if (
      fs.existsSync(resolvedCandidate) &&
      fs.statSync(resolvedCandidate).isFile()
    ) {
      return resolvedCandidate;
    }
  }

  return null;
};

const notifyLiveReloadMessages = (messages: LiveReloadMessage[]) => {
  if (messages.length === 0 || liveReloadSockets.size === 0) {
    return;
  }

  const htmlUpdates = messages.filter((message) => {
    return message.type === "html-update";
  });

  const cssUpdates = messages.filter((message) => {
    return message.type === "css-update";
  });

  const reloadMessage = messages.find((message) => {
    return message.type === "reload";
  });

  if (reloadMessage && reloadMessage.type === "reload") {
    for (const socket of liveReloadSockets) {
      socket.send(JSON.stringify(reloadMessage));
    }

    return;
  }

  for (const message of cssUpdates) {
    if (message.type !== "css-update") {
      continue;
    }

    for (const socket of liveReloadSockets) {
      socket.send(JSON.stringify(message));
    }
  }

  for (const message of htmlUpdates) {
    if (message.type !== "html-update") {
      continue;
    }

    for (const socket of liveReloadSockets) {
      if (socket.data.route !== message.route) {
        continue;
      }

      socket.send(JSON.stringify(message));
    }
  }
};

const getElementFixedWidth = (element: HtmlElementContext) => {
  const inlineWidthAttr = element.attrs.width
    ? Number(element.attrs.width)
    : null;

  if (inlineWidthAttr && Number.isFinite(inlineWidthAttr)) {
    return Math.ceil(inlineWidthAttr);
  }

  const inlineDeclarations = parseInlineStyle(element.attrs.style ?? "");
  const widthDeclaration = inlineDeclarations.width ?? null;
  const maxWidthDeclaration = inlineDeclarations["max-width"] ?? null;

  const widthLength = widthDeclaration
    ? parseCssLengthValue(widthDeclaration)
    : null;
  const maxWidthLength = maxWidthDeclaration
    ? parseCssLengthValue(maxWidthDeclaration)
    : null;

  if (widthLength?.kind === "px" && widthLength.value !== null) {
    return widthLength.value;
  }

  if (maxWidthLength?.kind === "px" && maxWidthLength.value !== null) {
    return maxWidthLength.value;
  }

  const winningDeclarations: Record<
    "width" | "max-width",
    { value: string; specificity: number; order: number } | null
  > = {
    width: null,
    "max-width": null,
  };

  const applyDeclaration = (
    property: "width" | "max-width",
    value: string | undefined,
    specificity: number,
    order: number,
  ) => {
    if (!value) {
      return;
    }

    const current = winningDeclarations[property];

    if (!isWinningDeclaration({ specificity, order }, current)) {
      return;
    }

    winningDeclarations[property] = {
      value,
      specificity,
      order,
    };
  };

  for (const rule of cssImageRules) {
    if (
      !selectorMatchesElement(rule.selector, element.attrs, element.tagName)
    ) {
      continue;
    }

    applyDeclaration(
      "width",
      rule.declarations.width,
      rule.specificity,
      rule.order,
    );
    applyDeclaration(
      "max-width",
      rule.declarations["max-width"],
      rule.specificity,
      rule.order,
    );
  }

  const resolvedWidth = winningDeclarations.width?.value ?? null;
  const resolvedMaxWidth = winningDeclarations["max-width"]?.value ?? null;

  const resolvedWidthLength = resolvedWidth
    ? parseCssLengthValue(resolvedWidth)
    : null;
  const resolvedMaxWidthLength = resolvedMaxWidth
    ? parseCssLengthValue(resolvedMaxWidth)
    : null;

  if (
    resolvedWidthLength?.kind === "px" &&
    resolvedWidthLength.value !== null
  ) {
    return resolvedWidthLength.value;
  }

  if (
    resolvedMaxWidthLength?.kind === "px" &&
    resolvedMaxWidthLength.value !== null &&
    (resolvedWidthLength === null ||
      resolvedWidthLength.kind === "auto" ||
      resolvedWidthLength.kind === "percent" ||
      resolvedWidthLength.kind === "vw")
  ) {
    return resolvedMaxWidthLength.value;
  }

  return null;
};

const getImageLayout = (
  attrs: Record<string, string>,
  ancestors: HtmlElementContext[] = [],
) => {
  const matchedCss: string[] = [];
  const seenMatches = new Set<string>();

  const addMatch = (selector: string) => {
    if (seenMatches.has(selector)) {
      return;
    }

    seenMatches.add(selector);
    matchedCss.push(selector);
  };

  const inlineWidthAttr = attrs.width ? Number(attrs.width) : null;

  if (inlineWidthAttr && Number.isFinite(inlineWidthAttr)) {
    return {
      kind: "fixed" as const,
      fixedWidth: Math.ceil(inlineWidthAttr),
      minWidth: null,
      maxWidth: null,
      sizes: `${Math.ceil(inlineWidthAttr)}px`,
      matchedCss,
    };
  }

  const inlineDeclarations = parseInlineStyle(attrs.style ?? "");

  const winningDeclarations: Record<
    "width" | "max-width" | "min-width",
    { value: string; specificity: number; order: number } | null
  > = {
    width: null,
    "max-width": null,
    "min-width": null,
  };

  const applyDeclaration = (
    property: "width" | "max-width" | "min-width",
    value: string | undefined,
    specificity: number,
    order: number,
  ) => {
    if (!value) {
      return;
    }

    const current = winningDeclarations[property];

    if (!isWinningDeclaration({ specificity, order }, current)) {
      return;
    }

    winningDeclarations[property] = {
      value,
      specificity,
      order,
    };
  };

  applyDeclaration("width", inlineDeclarations.width, 1_000_000, 1_000_000);
  applyDeclaration(
    "max-width",
    inlineDeclarations["max-width"],
    1_000_000,
    1_000_000,
  );
  applyDeclaration(
    "min-width",
    inlineDeclarations["min-width"],
    1_000_000,
    1_000_000,
  );

  if (Object.keys(inlineDeclarations).length > 0) {
    addMatch("[inline style]");
  }

  for (const rule of cssImageRules) {
    if (!selectorMatchesImage(rule.selector, attrs)) {
      continue;
    }

    addMatch(rule.selector);

    applyDeclaration(
      "width",
      rule.declarations.width,
      rule.specificity,
      rule.order,
    );
    applyDeclaration(
      "max-width",
      rule.declarations["max-width"],
      rule.specificity,
      rule.order,
    );
    applyDeclaration(
      "min-width",
      rule.declarations["min-width"],
      rule.specificity,
      rule.order,
    );
  }

  const widthDeclaration = winningDeclarations.width?.value ?? null;
  const maxWidthDeclaration = winningDeclarations["max-width"]?.value ?? null;
  const minWidthDeclaration = winningDeclarations["min-width"]?.value ?? null;

  const widthLength = widthDeclaration
    ? parseCssLengthValue(widthDeclaration)
    : null;
  const maxWidthLength = maxWidthDeclaration
    ? parseCssLengthValue(maxWidthDeclaration)
    : null;
  const minWidthLength = minWidthDeclaration
    ? parseCssLengthValue(minWidthDeclaration)
    : null;

  let kind: ImageLayout["kind"] = "unknown";
  let fixedWidth: number | null = null;
  let maxWidth: number | null = null;
  let minWidth: number | null = null;

  if (widthLength?.kind === "px" && widthLength.value !== null) {
    kind = "fixed";
    fixedWidth = widthLength.value;
  } else {
    if (maxWidthLength?.kind === "px" && maxWidthLength.value !== null) {
      maxWidth = maxWidthLength.value;
    }

    if (minWidthLength?.kind === "px" && minWidthLength.value !== null) {
      minWidth = minWidthLength.value;
    }

    const widthIsFluid =
      widthLength === null ||
      widthLength.kind === "auto" ||
      widthLength.kind === "percent" ||
      widthLength.kind === "vw";

    if (
      widthIsFluid &&
      (maxWidth !== null ||
        widthLength?.kind === "percent" ||
        widthLength?.kind === "vw")
    ) {
      kind = "fluid";
    } else if (maxWidth !== null) {
      kind = "fluid";
    }
  }

  const explicitSizes = attrs.sizes?.trim() || null;
  let sizes = "100vw";

  if (kind === "fixed" && fixedWidth !== null) {
    sizes = `${fixedWidth}px`;
  } else if (kind === "fluid" && maxWidth !== null) {
    sizes = `(max-width: ${maxWidth}px) 100vw, ${maxWidth}px`;
  } else if (explicitSizes) {
    sizes = explicitSizes;

    const explicitFixedMatch = explicitSizes.trim().match(/^([0-9.]+)px$/);

    if (explicitFixedMatch) {
      kind = "fixed";
      fixedWidth = Math.ceil(Number(explicitFixedMatch[1]));
    }
  }

  if (kind === "unknown" && explicitSizes === null) {
    sizes = "100vw";
  }

  if (kind === "unknown" && fixedWidth === null && maxWidth !== null) {
    kind = "fluid";
    sizes = `(max-width: ${maxWidth}px) 100vw, ${maxWidth}px`;
  }

  if (kind !== "fixed") {
    for (const ancestor of ancestors.slice().reverse()) {
      const ancestorWidth = getElementFixedWidth(ancestor);

      if (ancestorWidth === null) {
        continue;
      }

      const widthLooksFluid =
        widthLength === null ||
        widthLength.kind === "auto" ||
        widthLength.kind === "percent" ||
        widthLength.kind === "vw" ||
        widthDeclaration === "100%" ||
        widthDeclaration === "100vw";

      if (!widthLooksFluid) {
        continue;
      }

      kind = "fixed";
      fixedWidth = ancestorWidth;
      sizes = `${ancestorWidth}px`;
      addMatch(
        `${ancestor.tagName}${
          ancestor.attrs.class ? `.${ancestor.attrs.class.split(/\s+/)[0]}` : ""
        }`,
      );
      break;
    }
  }

  return {
    kind,
    fixedWidth,
    minWidth,
    maxWidth,
    sizes,
    matchedCss,
  } satisfies ImageLayout;
};

const parseLengthToPixels = (value: string, viewportWidth: number) => {
  const cleanValue = value.trim();

  if (cleanValue === "auto") {
    return null;
  }

  const pxMatch = cleanValue.match(/^([0-9.]+)px$/);

  if (pxMatch) {
    return Number(pxMatch[1]);
  }

  const remMatch = cleanValue.match(/^([0-9.]+)rem$/);

  if (remMatch) {
    return Number(remMatch[1]) * 16;
  }

  const vwMatch = cleanValue.match(/^([0-9.]+)vw$/);

  if (vwMatch) {
    return (Number(vwMatch[1]) / 100) * viewportWidth;
  }

  const percentMatch = cleanValue.match(/^([0-9.]+)%$/);

  if (percentMatch) {
    return (Number(percentMatch[1]) / 100) * viewportWidth;
  }

  return null;
};

const mediaConditionMatches = (condition: string, viewportWidth: number) => {
  const maxWidthMatch = condition.match(/max-width\s*:\s*([0-9.]+)px/);
  const minWidthMatch = condition.match(/min-width\s*:\s*([0-9.]+)px/);

  if (maxWidthMatch && viewportWidth > Number(maxWidthMatch[1])) {
    return false;
  }

  if (minWidthMatch && viewportWidth < Number(minWidthMatch[1])) {
    return false;
  }

  return true;
};

const splitSizesList = (sizes: string) => {
  const parts: string[] = [];
  let depth = 0;
  let buffer = "";

  for (const char of sizes) {
    if (char === "(") {
      depth += 1;
    }

    if (char === ")") {
      depth -= 1;
    }

    if (char === "," && depth === 0) {
      parts.push(buffer.trim());
      buffer = "";
      continue;
    }

    buffer += char;
  }

  if (buffer.trim().length > 0) {
    parts.push(buffer.trim());
  }

  return parts;
};

const getDisplayWidthForViewport = (
  sizes: string,
  viewportWidth: number,
  targetWidth: number | null,
) => {
  const sizeParts = splitSizesList(sizes);

  for (const sizePart of sizeParts) {
    const conditionMatch = sizePart.match(/^\(([^)]+)\)\s*(.+)$/);

    if (!conditionMatch) {
      const width = parseLengthToPixels(sizePart, viewportWidth);
      return width ?? targetWidth ?? viewportWidth;
    }

    const [, condition, length] = conditionMatch;

    if (mediaConditionMatches(condition, viewportWidth)) {
      const width = parseLengthToPixels(length, viewportWidth);
      return width ?? targetWidth ?? viewportWidth;
    }
  }

  return targetWidth ?? viewportWidth;
};

const getNeededWidthPlan = (
  originalWidth: number,
  layout: ImageLayout,
): NeededWidthPlan => {
  const candidates: NeededWidthCandidate[] = [];

  if (layout.kind === "fixed" && layout.fixedWidth !== null) {
    for (const devicePixelRatio of commonDevicePixelRatios) {
      candidates.push({
        width: Math.ceil(layout.fixedWidth * devicePixelRatio),
        source: `${layout.fixedWidth}px × ${devicePixelRatio}`,
        devicePixelRatio,
      });
    }
  } else {
    for (const viewportWidth of commonViewportWidths) {
      const displayWidth = getDisplayWidthForViewport(
        layout.sizes,
        viewportWidth,
        layout.fixedWidth,
      );

      for (const devicePixelRatio of commonDevicePixelRatios) {
        candidates.push({
          width: Math.ceil(displayWidth * devicePixelRatio),
          source: `${Math.ceil(displayWidth)}px @ ${viewportWidth}px viewport × ${devicePixelRatio}`,
          devicePixelRatio,
        });
      }
    }
  }

  const sourceByWidth = new Map<number, string>();

  const widths = [...new Set(candidates.map((candidate) => candidate.width))]
    .map((width) => {
      return Math.min(width, originalWidth);
    })
    .filter((width) => {
      return width >= minGeneratedImageWidth && width <= originalWidth;
    })
    .filter((width, index, values) => {
      return values.indexOf(width) === index;
    })
    .sort((a, b) => {
      return a - b;
    });

  for (const candidate of candidates) {
    const clampedWidth = Math.min(candidate.width, originalWidth);

    if (clampedWidth < minGeneratedImageWidth || clampedWidth > originalWidth) {
      continue;
    }

    if (!sourceByWidth.has(clampedWidth)) {
      sourceByWidth.set(clampedWidth, candidate.source);
    }
  }

  const largestCandidate =
    candidates.length > 0
      ? candidates.reduce((largest, candidate) => {
          return candidate.width > largest.width ? candidate : largest;
        })
      : null;

  if (widths.length === 0) {
    sourceByWidth.set(originalWidth, `${originalWidth}px fallback`);

    return {
      widths: [originalWidth],
      candidates,
      sourceByWidth,
      largestCandidate: largestCandidate ?? {
        width: originalWidth,
        source: `${originalWidth}px fallback`,
        devicePixelRatio: 1,
      },
    };
  }

  return {
    widths,
    candidates,
    sourceByWidth,
    largestCandidate,
  };
};

const preloadImageNameUsage = async () => {
  imageNameUsage.clear();

  await recursiveScan(publicFolder, (filename) => {
    if (!isOptimizableImage(filename)) {
      return;
    }

    const relativePath = path
      .relative(publicFolder, filename)
      .replaceAll(path.sep, "/");

    const baseName = path.parse(relativePath).name;
    const sourcesUsingBaseName =
      imageNameUsage.get(baseName) ?? new Set<string>();

    sourcesUsingBaseName.add(relativePath);
    imageNameUsage.set(baseName, sourcesUsingBaseName);
  });
};

const getShortHash = (value: string) => {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
};

const getOptimizedImageName = (
  sourceFile: string,
  width: number,
  formatName: ImageFormat,
) => {
  const relativePath = path
    .relative(publicFolder, sourceFile)
    .replaceAll(path.sep, "/");

  const parsed = path.parse(relativePath);
  const baseName = parsed.name;
  const sourcesUsingBaseName =
    imageNameUsage.get(baseName) ?? new Set<string>();

  sourcesUsingBaseName.add(relativePath);
  imageNameUsage.set(baseName, sourcesUsingBaseName);

  const finalBaseName =
    sourcesUsingBaseName.size > 1
      ? `${baseName}-${getShortHash(relativePath)}`
      : baseName;

  return `${finalBaseName}-${width}w.${formatName}`;
};

const convertImage = (
  sourceFile: string,
  outputFile: string,
  width: number,
  formatName: ImageFormat,
) => {
  ensureOutputFolder(outputFile);

  const args = ["-y", "-i", sourceFile, "-vf", `scale=${width}:-2`];

  if (formatName === "webp") {
    args.push("-c:v", "libwebp", "-quality", "82", "-compression_level", "6");
  }

  if (formatName === "avif") {
    args.push("-c:v", "libsvtav1", "-crf", "35", "-preset", "8");
  }

  if (formatName === "png") {
    args.push("-compression_level", "9");
  }

  if (formatName === "jpeg") {
    args.push("-q:v", "4");
  }

  args.push(outputFile);

  execFileSync("ffmpeg", args, {
    stdio: "ignore",
  });
};

const parseFaviconRounding = (
  attrs: Record<string, string>,
): FaviconRounding => {
  if (!Object.prototype.hasOwnProperty.call(attrs, "round")) {
    return {
      kind: "none",
    };
  }

  const value = attrs.round.trim().toLowerCase();

  if (!value || value === "true" || value === "circle" || value === "full") {
    return {
      kind: "circle",
    };
  }

  const percentMatch = value.match(/^([0-9.]+)%$/);

  if (percentMatch) {
    return {
      kind: "percent",
      value: Number(percentMatch[1]),
    };
  }

  const pxMatch = value.match(/^([0-9.]+)(?:px)?$/);

  if (pxMatch) {
    return {
      kind: "px",
      value: Number(pxMatch[1]),
    };
  }

  return {
    kind: "circle",
  };
};

const getFaviconRadius = (rounding: FaviconRounding, size: number) => {
  if (rounding.kind === "none") {
    return 0;
  }

  if (rounding.kind === "circle") {
    return size / 2;
  }

  if (rounding.kind === "percent") {
    return (size * Math.max(0, Math.min(rounding.value, 50))) / 100;
  }

  return Math.max(0, Math.min(rounding.value, size / 2));
};

const createSquareIconFilter = (size: number, rounding: FaviconRounding) => {
  const baseFilter = `scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size}`;
  const radius = getFaviconRadius(rounding, size);

  if (radius <= 0) {
    return baseFilter;
  }

  const roundedAlphaExpression = `if(lte(pow(max(abs(X-W/2)-(W/2-${radius}),0),2)+pow(max(abs(Y-H/2)-(H/2-${radius}),0),2),pow(${radius},2)),255,0)`;

  return `${baseFilter},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${roundedAlphaExpression}'`;
};

const convertSquarePng = (
  sourceFile: string,
  outputFile: string,
  size: number,
  rounding: FaviconRounding,
) => {
  ensureOutputFolder(outputFile);

  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      sourceFile,
      "-vf",
      createSquareIconFilter(size, rounding),
      "-frames:v",
      "1",
      outputFile,
    ],
    {
      stdio: "ignore",
    },
  );
};

const convertIco = (
  sourceFile: string,
  outputFile: string,
  rounding: FaviconRounding,
) => {
  ensureOutputFolder(outputFile);

  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      sourceFile,
      "-vf",
      createSquareIconFilter(32, rounding),
      "-frames:v",
      "1",
      outputFile,
    ],
    {
      stdio: "ignore",
    },
  );
};

const isFaviconRel = (rel: string) => {
  const relParts = rel.toLowerCase().split(/\s+/).filter(Boolean);

  return relParts.includes("icon") || relParts.includes("apple-touch-icon");
};

const findFaviconSourceInHtml = (
  htmlFile: string,
  html: string,
): FaviconSource | null => {
  for (const match of html.matchAll(/<link\b([^>]*?)>/gi)) {
    const attrs = parseAttributes(match[1]);

    if (!attrs.href || !isFaviconRel(attrs.rel ?? "")) {
      continue;
    }

    const sourceFile = resolvePublicAsset(htmlFile, attrs.href);

    if (!sourceFile || !fs.existsSync(sourceFile)) {
      continue;
    }

    if (isOptimizableImage(sourceFile)) {
      return {
        sourceFile,
        rounding: parseFaviconRounding(attrs),
      };
    }
  }

  return null;
};

const collectFaviconSource = async () => {
  let source: FaviconSource | null = null;

  await recursiveScan(publicFolder, (filename, data) => {
    if (source || !filename.endsWith(".html")) {
      return;
    }

    source = findFaviconSourceInHtml(
      filename,
      transpileHtml(data, 0, filename),
    );
  });

  return source;
};

const buildFavicons = (source: FaviconSource): FaviconBuild => {
  const { sourceFile, rounding } = source;
  const faviconIcoFile = path.join(distFolder, "favicon.ico");
  const favicon16File = path.join(generatedIconsFolder, "favicon-16x16.png");
  const favicon32File = path.join(generatedIconsFolder, "favicon-32x32.png");
  const appleTouchIconFile = path.join(distFolder, "apple-touch-icon.png");

  convertIco(sourceFile, faviconIcoFile, rounding);
  convertSquarePng(sourceFile, favicon16File, 16, rounding);
  convertSquarePng(sourceFile, favicon32File, 32, rounding);
  convertSquarePng(sourceFile, appleTouchIconFile, 180, rounding);

  const assets: FaviconAsset[] = [
    {
      rel: "icon",
      href: faviconIcoFile,
      size: null,
      type: "image/x-icon",
    },
    {
      rel: "icon",
      href: favicon32File,
      size: 32,
      type: "image/png",
    },
    {
      rel: "icon",
      href: favicon16File,
      size: 16,
      type: "image/png",
    },
    {
      rel: "apple-touch-icon",
      href: appleTouchIconFile,
      size: 180,
      type: "image/png",
    },
  ];

  return {
    sourceFile,
    assets,
  };
};

const optimizeImage = (
  htmlFile: string,
  sourceFile: string,
  layout: ImageLayout,
): OptimizedImageSet => {
  const cacheKey = `${htmlFile}:${sourceFile}:${layout.kind}:${layout.fixedWidth ?? "auto"}:${layout.minWidth ?? "auto"}:${layout.maxWidth ?? "auto"}:${layout.sizes}:${outputImageFormats.join(",")}`;

  const cached = optimizedImageCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const dimensions = getImageDimensions(sourceFile);

  if (!dimensions) {
    return {
      formats: outputImageFormats,
      variantsByFormat: {
        avif: [],
        webp: [],
        png: [],
        jpeg: [],
      },
    };
  }

  const widthPlan = getNeededWidthPlan(dimensions.width, layout);
  const widths = widthPlan.widths;

  if (isDebugImages) {
    const generated = widths
      .map((width) => {
        const source = widthPlan.sourceByWidth.get(width);

        return source ? `${width}w (${source})` : `${width}w`;
      })
      .join(", ");

    const largestCandidate = widthPlan.largestCandidate;

    logInfo(
      `${path.basename(sourceFile)}\n    layout: ${layout.kind}\n    sizes: ${layout.sizes}\n    original: ${dimensions.width}w\n    largest candidate: ${largestCandidate ? `${largestCandidate.width}w from ${largestCandidate.source}` : "(none)"}\n    generated: ${generated || "(none)"}\n    matched css: ${layout.matchedCss.length > 0 ? layout.matchedCss.join(", ") : "(none)"}`,
    );
  }

  const imageSet: OptimizedImageSet = {
    formats: outputImageFormats,
    variantsByFormat: {
      avif: [],
      webp: [],
      png: [],
      jpeg: [],
    },
  };

  for (const formatName of outputImageFormats) {
    for (const width of widths) {
      const outputName = getOptimizedImageName(sourceFile, width, formatName);
      const outputFile = path.join(optimizedImagesFolder, outputName);
      const publicPath = toPublicOutputFilePath(htmlFile, outputFile);

      if (!fs.existsSync(outputFile)) {
        convertImage(sourceFile, outputFile, width, formatName);
      }

      imageSet.variantsByFormat[formatName].push({
        width,
        file: outputFile,
        publicPath,
        format: formatName,
      });
    }
  }

  optimizedImageCache.set(cacheKey, imageSet);

  return imageSet;
};

const buildSrcset = (variants: ImageVariant[]) => {
  return variants
    .map((variant) => {
      return `${variant.publicPath} ${variant.width}w`;
    })
    .join(", ");
};

const getFallbackImageVariants = (imageSet: OptimizedImageSet) => {
  const fallbackFormatOrder: ImageFormat[] = ["webp", "jpeg", "png", "avif"];

  for (const formatName of fallbackFormatOrder) {
    const variants = imageSet.variantsByFormat[formatName];

    if (variants.length > 0) {
      return variants;
    }
  }

  for (const formatName of imageSet.formats) {
    const variants = imageSet.variantsByFormat[formatName];

    if (variants.length > 0) {
      return variants;
    }
  }

  return [];
};

const escapeAttributeValue = (value: string) => {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
};

const getImageMimeType = (formatName: ImageFormat) => {
  return `image/${formatName}`;
};

const createSourceTag = (
  formatName: ImageFormat,
  variants: ImageVariant[],
  sizes: string,
) => {
  return `<source type="${getImageMimeType(formatName)}" srcset="${escapeAttributeValue(
    buildSrcset(variants),
  )}" sizes="${escapeAttributeValue(sizes)}">`;
};

const isInsidePictureElement = (html: string, offset: number) => {
  const lastOpenPicture = html.lastIndexOf("<picture", offset);

  if (lastOpenPicture === -1) {
    return false;
  }

  const lastClosePicture = html.lastIndexOf("</picture>", offset);

  return lastOpenPicture > lastClosePicture;
};

const optimizeImagesInHtml = (htmlFile: string, data: string) => {
  return data.replace(
    /<img\s+([^>]*?)\/?>/gi,
    (fullTag, rawAttributes: string, offset: number, html: string) => {
      if (isInsidePictureElement(html, offset)) {
        return fullTag;
      }

      const attrs = parseAttributes(rawAttributes);
      const src = attrs.src;

      if (!src || isExternalImage(src)) {
        return fullTag;
      }

      const sourceFile = resolvePublicAsset(htmlFile, src);

      if (!sourceFile || !fs.existsSync(sourceFile)) {
        logWarning(
          `image:${htmlFile}:${src}:not-found`,
          `Image not found in ${dim(formatSourcePath(htmlFile))}: ${src}`,
        );
        return fullTag;
      }

      if (isPassthroughImage(sourceFile)) {
        return fullTag;
      }

      if (!isOptimizableImage(sourceFile)) {
        return fullTag;
      }

      const ancestors = getHtmlAncestorStack(html, offset);
      const layout = getImageLayout(attrs, ancestors);
      const imageSet = optimizeImage(htmlFile, sourceFile, layout);

      const hasOptimizedVariants = imageSet.formats.some((formatName) => {
        return imageSet.variantsByFormat[formatName].length > 0;
      });

      if (!hasOptimizedVariants) {
        return fullTag;
      }

      const fallbackVariants = getFallbackImageVariants(imageSet);

      const largestFallbackVariant =
        fallbackVariants[fallbackVariants.length - 1];

      let imgTag = fullTag;

      imgTag = removeAttribute(imgTag, "srcset");
      imgTag = removeAttribute(imgTag, "sizes");

      imgTag = replaceAttribute(
        imgTag,
        "src",
        largestFallbackVariant.publicPath,
      );
      imgTag = replaceAttribute(imgTag, "loading", attrs.loading || "lazy");
      imgTag = replaceAttribute(imgTag, "decoding", attrs.decoding || "async");

      const sourceTags: string[] = [];

      for (const formatName of imageSet.formats) {
        const variants = imageSet.variantsByFormat[formatName];

        if (variants.length > 0) {
          sourceTags.push(createSourceTag(formatName, variants, layout.sizes));
        }
      }

      const dimensions = getImageDimensions(sourceFile);

      if (dimensions) {
        if (!attrs.width) {
          imgTag = replaceAttribute(imgTag, "width", String(dimensions.width));
        }

        if (!attrs.height) {
          imgTag = replaceAttribute(
            imgTag,
            "height",
            String(dimensions.height),
          );
        }
      }

      return `<picture>\n${sourceTags.join("\n")}\n${imgTag}\n</picture>`;
    },
  );
};

const metadataImageFields = new Set(["og:image", "twitter:image"]);

const getMetadataImageLayout = (sourceFile: string): ImageLayout => {
  const dimensions = getImageDimensions(sourceFile);

  if (dimensions) {
    return {
      kind: "fixed",
      fixedWidth: dimensions.width,
      minWidth: null,
      maxWidth: null,
      sizes: `${dimensions.width}px`,
      matchedCss: ["metadata image"],
    };
  }

  return {
    kind: "unknown",
    fixedWidth: null,
    minWidth: null,
    maxWidth: null,
    sizes: "100vw",
    matchedCss: ["metadata image"],
  };
};

const optimizeMetadataImagesInHtml = (htmlFile: string, data: string) => {
  return data.replace(/<meta\b([^>]*?)\/?>/gi, (fullTag, rawAttributes) => {
    const attrs = parseAttributes(rawAttributes);
    const fieldName = (attrs.property ?? attrs.name ?? "").toLowerCase();
    const content = attrs.content;

    if (!metadataImageFields.has(fieldName) || !content) {
      return fullTag;
    }

    if (isExternalImage(content)) {
      return fullTag;
    }

    const sourceFile = resolvePublicAsset(htmlFile, content);

    if (!sourceFile || !fs.existsSync(sourceFile)) {
      return fullTag;
    }

    if (!isOptimizableImage(sourceFile) || isPassthroughImage(sourceFile)) {
      return fullTag;
    }

    const imageSet = optimizeImage(
      htmlFile,
      sourceFile,
      getMetadataImageLayout(sourceFile),
    );
    const fallbackVariants = getFallbackImageVariants(imageSet);
    const largestFallbackVariant =
      fallbackVariants[fallbackVariants.length - 1];

    if (!largestFallbackVariant) {
      return fullTag;
    }

    return replaceAttribute(
      fullTag,
      "content",
      largestFallbackVariant.publicPath,
    );
  });
};

const compactSrcset = (sourceTagAttributes: string, rawSrcset: string) => {
  const candidateSource = `${rawSrcset} ${sourceTagAttributes}`;
  const candidates: string[] = [];

  for (const match of candidateSource.matchAll(
    /((?:https?:\/\/|\/\/|\/|\.{1,2}\/)[^\s"',<>]+)\s+(\d+w|\d+(?:\.\d+)?x)/g,
  )) {
    candidates.push(`${match[1]} ${match[2]}`);
  }

  if (candidates.length > 0) {
    return [...new Set(candidates)].join(", ");
  }

  return rawSrcset
    .split(",")
    .map((candidate) => candidate.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join(", ");
};

const normalizeSourceSrcsets = (html: string) => {
  return html.replace(
    /<source\b([\s\S]*?)\/?>/gi,
    (sourceTag, rawAttributes) => {
      const attrs = parseAttributes(rawAttributes);

      if (!attrs.srcset) {
        return sourceTag;
      }

      const orderedAttributeNames = [
        "type",
        "media",
        "srcset",
        "sizes",
        ...Object.keys(attrs).filter((name) => {
          return !["type", "media", "srcset", "sizes"].includes(name);
        }),
      ].filter((name, index, names) => {
        return (
          Object.prototype.hasOwnProperty.call(attrs, name) &&
          names.indexOf(name) === index
        );
      });

      const normalizedAttrs: Record<string, string> = {
        ...attrs,
        srcset: compactSrcset(rawAttributes, attrs.srcset),
      };

      const serializedAttributes = orderedAttributeNames
        .map((name) => {
          return `${name}="${escapeAttributeValue(normalizedAttrs[name])}"`;
        })
        .join(" ");

      return `<source ${serializedAttributes}>`;
    },
  );
};

const shouldRemoveGeneratedFaviconTag = (tag: string) => {
  const attrsMatch = tag.match(/^<link\b([^>]*?)>/i);

  if (!attrsMatch) {
    return false;
  }

  const attrs = parseAttributes(attrsMatch[1]);
  const rel = (attrs.rel ?? "").toLowerCase();

  return isFaviconRel(rel) || rel.split(/\s+/).includes("manifest");
};

const hasThemeColorMeta = (html: string) => {
  for (const match of html.matchAll(/<meta\b([^>]*?)\/?>/gi)) {
    const attrs = parseAttributes(match[1]);

    if ((attrs.name ?? "").toLowerCase() === "theme-color") {
      return true;
    }
  }

  return false;
};

const createFaviconMarkup = (
  htmlFile: string,
  html: string,
  buildInfo: FaviconBuild,
) => {
  const iconTags = buildInfo.assets.map((asset) => {
    const href = toPublicOutputFilePath(htmlFile, asset.href);
    const sizes = asset.size ? ` sizes="${asset.size}x${asset.size}"` : "";
    const type = asset.type ? ` type="${asset.type}"` : "";

    return `<link rel="${asset.rel}"${type}${sizes} href="${href}" />`;
  });

  const tags = [
    ...iconTags,
    ...(hasThemeColorMeta(html)
      ? []
      : [`<meta name="theme-color" content="#0c0c0f" />`]),
  ];

  return tags.join("\n");
};

const injectFavicons = (htmlFile: string, html: string) => {
  if (!faviconBuild) {
    return html;
  }

  const withoutIconLinks = html.replace(/<link\b[^>]*?>/gi, (tag) => {
    return shouldRemoveGeneratedFaviconTag(tag) ? "" : tag;
  });
  const faviconMarkup = createFaviconMarkup(
    htmlFile,
    withoutIconLinks,
    faviconBuild,
  );

  if (withoutIconLinks.includes("</head>")) {
    return withoutIconLinks.replace("</head>", `${faviconMarkup}\n</head>`);
  }

  return `${faviconMarkup}\n${withoutIconLinks}`;
};

const saveHtmlFile = async (sourceFile: string, data: string) => {
  const outputFile = getDistPath(sourceFile);

  try {
    const optimizedData = optimizeImagesInHtml(sourceFile, data);
    const optimizedMetadataData = optimizeMetadataImagesInHtml(
      sourceFile,
      optimizedData,
    );
    const relinkedData = rewriteLocalPublicUrls(
      sourceFile,
      optimizedMetadataData,
    );
    const withStylesheets = rewriteLocalStylesheetLinks(sourceFile, relinkedData);
    const withFavicons = injectFavicons(sourceFile, withStylesheets);

    const formattedData = await format(withFavicons, {
      parser: "html",
      tabWidth: 4,
      printWidth: 160,
      bracketSameLine: true,
      htmlSelfClosingSlash: false,
    });

    const formattedDataSelfClosed = formattedData.replace(
      /<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)([^>]*)\s\/>/gi,

      "<$1$2>",
    );
    const finalData = normalizeSourceSrcsets(formattedDataSelfClosed);

    ensureOutputFolder(outputFile);
    fs.writeFileSync(outputFile, finalData);

    const route = getHtmlRouteFromOutputFile(outputFile);

    if (route) {
      currentBuildSeenRoutes.add(route);

      if (htmlRouteSnapshots.get(route) !== finalData) {
        currentBuildHtmlUpdates.set(route, finalData);
      }

      htmlRouteSnapshots.set(route, finalData);
    }
  } catch (e) {
    logError(e instanceof Error ? (e.stack ?? e.message) : String(e));
  }
};

const startServe = () => {
  if (liveReloadServer) {
    return liveReloadServer;
  }

  liveReloadServer = Bun.serve<LiveReloadSocketData>({
    port: servePort,
    fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/__live") {
        const route = normalizeRoutePath(url.searchParams.get("route") ?? "/");
        const upgraded = server.upgrade(req, {
          data: {
            route,
          },
        });

        if (upgraded) {
          return undefined;
        }

        return new Response("WebSocket upgrade failed", {
          status: 400,
        });
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        return new Response("Method Not Allowed", {
          status: 405,
        });
      }

      const resolvedFile = resolveDistFile(url.pathname);
      const requestRoute = normalizeRoutePath(url.pathname);

      if (!resolvedFile) {
        return new Response(renderNotFoundPage(requestRoute), {
          status: 404,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        });
      }

      const contentType = getContentType(resolvedFile);

      if (path.extname(resolvedFile).toLowerCase() === ".html") {
        const route = getHtmlRouteFromOutputFile(resolvedFile) ?? requestRoute;
        const html = fs.readFileSync(resolvedFile, "utf8");
        const body = injectLiveReloadScript(html, route);

        return new Response(body, {
          headers: {
            "Content-Type": contentType,
          },
        });
      }

      return new Response(Bun.file(resolvedFile), {
        headers: {
          "Content-Type": contentType,
        },
      });
    },
    websocket: {
      open(ws) {
        liveReloadSockets.add(ws);
      },
      close(ws) {
        liveReloadSockets.delete(ws);
      },
      message() {
        return;
      },
    },
  });

  logInfo(
    `Serving ${dim("./dist")} on ${cyan(`http://localhost:${servePort}`)}`,
  );

  return liveReloadServer;
};

const copyStaticFile = (sourceFile: string, data: string) => {
  const outputFile = getDistPath(sourceFile);

  ensureOutputFolder(outputFile);

  if (sourceFile.endsWith(".css")) {
    const outputData = bundlePageStylesheet(sourceFile, data);

    fs.writeFileSync(outputFile, outputData);

    const relativePath = getPublicRelativePath(sourceFile);
    const previousSnapshot = emittedStylesheetSnapshots.get(relativePath);

    if (previousSnapshot !== outputData) {
      currentBuildCssUpdates.add(getPublicHref(sourceFile));
    }

    emittedStylesheetSnapshots.set(relativePath, outputData);

    return;
  }

  fs.copyFileSync(sourceFile, outputFile);
};

const shouldCopyStaticFile = (sourceFile: string) => {
  if (isOptimizableImage(sourceFile)) {
    return false;
  }

  return true;
};

const build = async () => {
  if (isBuilding) {
    rebuildRequested = true;
    if (!rebuildTimer) {
      scheduleBuild();
    }
    return;
  }

  isBuilding = true;

  try {
    previousBuildHtmlRoutes = new Set(htmlRouteSnapshots.keys());
    currentBuildSeenRoutes.clear();
    currentBuildSeenPublicFiles.clear();
    currentBuildHtmlUpdates.clear();
    currentBuildCssUpdates.clear();
    currentBuildReloadAll = false;
    emittedWarnings.clear();
    emittedErrors.clear();

    components.length = 0;
    optimizedImageCache.clear();
    imageNameUsage.clear();
    resetStylesheetLayers();
    faviconBuild = null;

    fs.rmSync(distFolder, {
      recursive: true,
      force: true,
    });

    await recursiveScan(componentsFolder, parseComponent);
    await collectPageStylesheetComponentCssFiles();
    await loadCssImageRules();
    await preloadImageNameUsage();

    const faviconSource = await collectFaviconSource();

    if (faviconSource) {
      faviconBuild = buildFavicons(faviconSource);
    }

    await recursiveScan(publicFolder, async (filename, data) => {
      if (!filename.endsWith(".html")) {
        if (filename.endsWith(".css")) {
          collectStylesheetFile(filename, data);
        } else if (shouldCopyStaticFile(filename)) {
          copyStaticFile(filename, data);
        }

        recordPublicAssetChange(filename, data);
        return;
      }

      validatePublicComponentUsages(filename, data);
      const output = transpileHtml(data, 0, filename);
      await saveHtmlFile(filename, output);
    });

    await emitGeneratedStylesheets();

    for (const route of previousBuildHtmlRoutes) {
      if (currentBuildSeenRoutes.has(route)) {
        continue;
      }

      htmlRouteSnapshots.delete(route);
      currentBuildHtmlUpdates.set(route, renderNotFoundPage(route));
    }

    for (const relativePath of publicFileSnapshots.keys()) {
      if (currentBuildSeenPublicFiles.has(relativePath)) {
        continue;
      }

      publicFileSnapshots.delete(relativePath);

      if (relativePath.endsWith(".css") || relativePath.endsWith(".js")) {
        currentBuildReloadAll = true;
      }
    }

    logSuccess(
      `Compiled ${bold(String(components.length))} components, loaded ${bold(
        String(cssImageRules.length),
      )} CSS image sizing rules, optimized images.`,
    );

    if (isServeMode) {
      notifyLiveReloadMessages([
        ...Array.from(currentBuildHtmlUpdates.entries()).map(
          ([route, html]) => ({
            type: "html-update" as const,
            route,
            html,
          }),
        ),
        ...Array.from(currentBuildCssUpdates.values()).map((href) => ({
          type: "css-update" as const,
          href,
        })),
        ...(currentBuildReloadAll ? [{ type: "reload" as const }] : []),
      ]);
    }
  } catch (error) {
    logError(
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
  } finally {
    isBuilding = false;

    if ((isWatchMode || isServeMode) && rebuildRequested && !rebuildTimer) {
      scheduleBuild();
    }
  }
};

const scheduleBuild = () => {
  rebuildRequested = true;

  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
  }

  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;

    if (!rebuildRequested) {
      return;
    }

    rebuildRequested = false;

    if (isBuilding) {
      rebuildRequested = true;
      return;
    }

    build().catch((error) => {
      logError(
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
    });
  }, rebuildDelayMs);
};

const watchFolder = (folder: string) => {
  if (!fs.existsSync(folder)) {
    return;
  }

  fs.watch(
    folder,
    {
      recursive: true,
    },
    () => {
      scheduleBuild();
    },
  );
};

if (isHelpMode) {
  printHelp();
} else {
  await build();

  if (isServeMode) {
    startServe();
  }

  if (isWatchMode || isServeMode) {
    watchFolder(componentsFolder);
    watchFolder(publicFolder);
    logInfo("Watching for changes...");
  }
}

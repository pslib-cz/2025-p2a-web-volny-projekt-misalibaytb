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
  args: string[];
  blocks: ComponentBlock[];
};

const componentPrefix = "misaliba";
const componentsFolder = "./components";
const publicFolder = "./public";
const distFolder = "./dist";

const components: Component[] = [];
const isWatchMode = process.argv.includes("watch");

let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
let isBuilding = false;

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
  return (
    rawArgs
      ?.split(",")
      .map((arg) => arg.trim())
      .filter(Boolean) ?? []
  );
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

const validateComponent = (filename: string, component: Component) => {
  const duplicateArgs = getDuplicateValues(component.args);

  if (duplicateArgs.length > 0) {
    console.log(
      `[${filename}] Duplicate args in ${component.name}:`,
      duplicateArgs,
    );
  }

  const allUsedArgs = component.blocks.flatMap((block) => {
    return getUsedArgs(block.code);
  });

  const conditionArgs = component.blocks
    .map((block) => block.condition?.arg)
    .filter((arg): arg is string => {
      return arg !== undefined;
    });

  const unusedArgs = component.args.filter((arg) => {
    return !allUsedArgs.includes(arg) && !conditionArgs.includes(arg);
  });

  const unknownArgs = allUsedArgs.filter((arg) => {
    return !component.args.includes(arg);
  });

  const unknownConditionArgs = conditionArgs.filter((arg) => {
    return !component.args.includes(arg);
  });

  if (unusedArgs.length > 0) {
    console.log(`[${filename}] Unused args in ${component.name}:`, unusedArgs);
  }

  if (unknownArgs.length > 0) {
    console.log(
      `[${filename}] Unknown args in ${component.name}:`,
      unknownArgs,
    );
  }

  if (unknownConditionArgs.length > 0) {
    console.log(
      `[${filename}] Unknown condition args in ${component.name}:`,
      unknownConditionArgs,
    );
  }
};

const parseComponent = (filename: string, data: string) => {
  const [header = "", ...rest] = data.split("\n");
  const code = rest.join("\n");

  const match = header.trim().match(/^\[component:([^;\]]+)(?:;([^\]]+))?\]$/);

  if (!match) {
    console.log(`[${filename}] Invalid component header: ${header}`);
    return;
  }

  const component: Component = {
    name: match[1].trim(),
    args: parseDeclaredArgs(match[2]),
    blocks: parseComponentBlocks(code),
  };

  validateComponent(filename, component);
  components.push(component);
};

const parseUsageArgs = (rawArgs: string) => {
  const args: Record<string, string> = {};
  const matches = rawArgs.matchAll(/([a-zA-Z0-9_-]+)="([^"]*)"/g);

  for (const match of matches) {
    args[match[1]] = match[2];
  }

  return args;
};

const renderComponent = (
  component: Component,
  args: Record<string, string>,
  depth = 0,
): string => {
  if (depth > 50) {
    console.log(
      `Max component render depth reached in ${component.name}. Possible recursive component call.`,
    );
    return "";
  }

  const selectedBlock =
    component.blocks.find((block) => {
      return (
        block.condition !== null &&
        args[block.condition.arg] === block.condition.value
      );
    }) ??
    component.blocks.find((block) => {
      return block.condition === null;
    }) ??
    component.blocks[0];

  if (!selectedBlock) {
    return "";
  }

  const renderedCode = selectedBlock.code.replace(
    /\{([^}]+)\}/g,
    (_match, argName: string) => {
      return args[argName.trim()] ?? "";
    },
  );

  return transpileHtml(renderedCode, depth + 1);
};

const transpileHtml = (data: string, depth = 0) => {
  let output = data;

  for (const component of components) {
    const tagName = `${componentPrefix}-${component.name}`;

    const pairedTagRegex = new RegExp(
      `<${tagName}\\s*([^>]*)>\\s*</${tagName}>`,
      "g",
    );

    const selfClosingTagRegex = new RegExp(`<${tagName}\\s*([^>]*)\\s*/>`, "g");

    const renderTag = (_match: string, rawArgs: string) => {
      const args = parseUsageArgs(rawArgs);
      return renderComponent(component, args, depth);
    };

    output = output.replace(pairedTagRegex, renderTag);
    output = output.replace(selfClosingTagRegex, renderTag);
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

const saveHtmlFile = async (sourceFile: string, data: string) => {
  const outputFile = getDistPath(sourceFile);
  try {
    const formattedData = await format(data, {
      parser: "html",
      tabWidth: 4,
      printWidth: 160,
      bracketSameLine: true,
    });

    ensureOutputFolder(outputFile);
    fs.writeFileSync(outputFile, formattedData);
  } catch (e) {
    console.log(e);
  }
};

const copyStaticFile = (sourceFile: string) => {
  const outputFile = getDistPath(sourceFile);

  ensureOutputFolder(outputFile);
  fs.copyFileSync(sourceFile, outputFile);
};

const build = async () => {
  if (isBuilding) {
    return;
  }

  isBuilding = true;
  components.length = 0;

  fs.rmSync(distFolder, {
    recursive: true,
    force: true,
  });

  await recursiveScan(componentsFolder, parseComponent);

  await recursiveScan(publicFolder, async (filename, data) => {
    if (!filename.endsWith(".html")) {
      copyStaticFile(filename);
      return;
    }

    const output = transpileHtml(data);
    await saveHtmlFile(filename, output);
  });

  console.log(`Compiled ${components.length} components.`);
  isBuilding = false;
};

const scheduleBuild = () => {
  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
  }

  rebuildTimer = setTimeout(() => {
    build().catch((error) => {
      console.error(error);
    });
  }, 100);
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

await build();

if (isWatchMode) {
  watchFolder(componentsFolder);
  watchFolder(publicFolder);
  console.log("Watching for changes...");
}

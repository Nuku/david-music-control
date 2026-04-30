const MODULE_ID = "pf2-david-music-control";

const DEFAULTS = {
  maxDimension: 1400,
  localRadius: 14,
  darknessOffset: 24,
  gradientThreshold: 42,
  minRunCells: 0.8,
  mergeGapCells: 0.5,
  snapDivisions: 2,
  doorMeanMin: 60,
  doorMeanMax: 128,
  doorStdMin: 26
};

let previewContainer = null;
let lastDetection = null;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "maxDimension", {
    name: "Maximum detection dimension",
    hint: "Scene images larger than this are downscaled while detecting, then scaled back to scene coordinates.",
    scope: "world",
    config: true,
    type: Number,
    default: DEFAULTS.maxDimension
  });

  game.modules.get(MODULE_ID).api = {
    detectActiveScene,
    clearPreview,
    applyLastDetection
  };
});

Hooks.on("getSceneControlButtons", controls => {
  const target = findSceneControl(controls, "walls") ?? findSceneControl(controls, "lighting") ?? firstSceneControl(controls);
  const tools = getSceneControlTools(target);
  if (!tools) return;
  const autoWallTool = {
    name: "auto-walls",
    title: "Auto Wall Scene",
    icon: "fa-solid fa-draw-polygon",
    order: getSceneControlToolCount(tools),
    button: true,
    visible: game.user.isGM,
    onChange: () => showAutoWallsDialog(),
    onClick: () => showAutoWallsDialog()
  };
  if (Array.isArray(tools)) {
    tools.push(autoWallTool);
  } else {
    tools["auto-walls"] = autoWallTool;
  }
});

function showAutoWallsDialog() {
  const maxDimension = game.settings.get(MODULE_ID, "maxDimension") || DEFAULTS.maxDimension;
  const gridSize = getSceneGridSize(canvas.scene);
  const content = `
    <form class="foundry-auto-walls-dialog">
      <div class="form-group">
        <label>Max dimension</label>
        <input type="number" name="maxDimension" min="400" max="2400" step="100" value="${maxDimension}">
      </div>
      <div class="form-group">
        <label>Grid size</label>
        <input type="number" name="gridSize" min="16" max="400" step="1" value="${gridSize}">
      </div>
      <div class="form-group">
        <label>Min span</label>
        <input type="number" name="minRunCells" min="0.3" max="2.5" step="0.05" value="${DEFAULTS.minRunCells}">
      </div>
      <div class="form-group">
        <label>Merge gap</label>
        <input type="number" name="mergeGapCells" min="0" max="2" step="0.05" value="${DEFAULTS.mergeGapCells}">
      </div>
      <div class="form-group">
        <label>Edge strictness</label>
        <input type="number" name="gradientThreshold" min="8" max="120" step="1" value="${DEFAULTS.gradientThreshold}">
      </div>
      <div class="form-group">
        <label>Dark strictness</label>
        <input type="number" name="darknessOffset" min="4" max="80" step="1" value="${DEFAULTS.darknessOffset}">
      </div>
      <p class="notes">Creates a preview first. Use Apply only after reviewing the overlay.</p>
    </form>
  `;

  if (foundry.applications?.api?.DialogV2) {
    new foundry.applications.api.DialogV2({
      window: { title: "Auto Wall Scene" },
      content,
      buttons: [
        {
          action: "preview",
          icon: "fa-solid fa-eye",
          label: "Preview",
          default: true,
          callback: (event, button) => {
            const options = readFormOptions(button.form);
            detectActiveScene(options).catch(error => reportError(error));
          }
        },
        {
          action: "apply",
          icon: "fa-solid fa-check",
          label: "Apply Last",
          callback: () => applyLastDetection().catch(error => reportError(error))
        },
        {
          action: "clear",
          icon: "fa-solid fa-trash",
          label: "Clear Preview",
          callback: () => clearPreview()
        }
      ]
    }).render({ force: true });
    return;
  }

  new Dialog({
    title: "Auto Wall Scene",
    content,
    buttons: {
      preview: {
        icon: '<i class="fas fa-eye"></i>',
        label: "Preview",
        callback: html => {
          const options = readDialogOptions(html);
          detectActiveScene(options).catch(error => reportError(error));
        }
      },
      apply: {
        icon: '<i class="fas fa-check"></i>',
        label: "Apply Last",
        callback: () => applyLastDetection().catch(error => reportError(error))
      },
      clear: {
        icon: '<i class="fas fa-trash"></i>',
        label: "Clear Preview",
        callback: () => clearPreview()
      }
    },
    default: "preview"
  }).render(true);
}

function readDialogOptions(html) {
  const form = html[0]?.querySelector("form") ?? html.querySelector?.("form");
  return readFormOptions(form);
}

function readFormOptions(form) {
  return {
    maxDimension: Number(form?.maxDimension?.value) || DEFAULTS.maxDimension,
    gridSize: Number(form?.gridSize?.value) || getSceneGridSize(canvas.scene),
    minRunCells: readNumber(form?.minRunCells?.value, DEFAULTS.minRunCells),
    mergeGapCells: readNumber(form?.mergeGapCells?.value, DEFAULTS.mergeGapCells),
    gradientThreshold: readNumber(form?.gradientThreshold?.value, DEFAULTS.gradientThreshold),
    darknessOffset: readNumber(form?.darknessOffset?.value, DEFAULTS.darknessOffset)
  };
}

function readNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function detectActiveScene(options = {}) {
  if (!canvas?.scene) throw new Error("No active scene.");
  const imageSource = getSceneImageSource(canvas.scene);
  if (!imageSource) throw new Error("The active scene does not have a background image.");

  const maxDimension = Number(options.maxDimension) || game.settings.get(MODULE_ID, "maxDimension") || DEFAULTS.maxDimension;
  const gridSize = Number(options.gridSize) || getSceneGridSize(canvas.scene);
  const image = await loadHtmlImage(imageSource);
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const imageTransform = getSceneImageTransform(imageWidth, imageHeight);
  const prepared = drawScaledImage(image, maxDimension);
  const detection = detectWallsFromImageData(prepared.imageData, {
    gridSize: (gridSize / imageTransform.averageScale) * prepared.scale,
    scale: prepared.scale,
    minRunCells: options.minRunCells,
    mergeGapCells: options.mergeGapCells,
    gradientThreshold: options.gradientThreshold,
    darknessOffset: options.darknessOffset
  });
  const walls = detection.walls.map(segment => imageSegmentToScene(segment, imageTransform));
  const doors = detection.doors.map(segment => imageSegmentToScene(segment, imageTransform));

  lastDetection = {
    sceneId: canvas.scene.id,
    walls,
    doors,
    source: imageSource
  };
  renderPreview(lastDetection);
  ui.notifications.info(`Auto Walls preview: ${detection.walls.length} walls, ${detection.doors.length} doors.`);
  return lastDetection;
}

function getSceneImageSource(scene) {
  return scene.background?.src || scene.img || scene.thumbnail || "";
}

function getSceneGridSize(scene) {
  return Number(scene.grid?.size || scene.grid?.distance || 72);
}

function getSceneImageTransform(imageWidth, imageHeight) {
  const dimensions = canvas.dimensions ?? canvas.scene?.dimensions ?? {};
  const sceneX = Number(dimensions.sceneX ?? dimensions.sceneRect?.x ?? 0);
  const sceneY = Number(dimensions.sceneY ?? dimensions.sceneRect?.y ?? 0);
  const sceneWidth = Number(dimensions.sceneWidth ?? dimensions.sceneRect?.width ?? canvas.scene?.width ?? imageWidth);
  const sceneHeight = Number(dimensions.sceneHeight ?? dimensions.sceneRect?.height ?? canvas.scene?.height ?? imageHeight);
  const scaleX = sceneWidth / Math.max(imageWidth, 1);
  const scaleY = sceneHeight / Math.max(imageHeight, 1);
  return {
    sceneX,
    sceneY,
    scaleX,
    scaleY,
    averageScale: (scaleX + scaleY) / 2
  };
}

function imageSegmentToScene(segment, transform) {
  return {
    x1: Math.round(transform.sceneX + (segment.x1 * transform.scaleX)),
    y1: Math.round(transform.sceneY + (segment.y1 * transform.scaleY)),
    x2: Math.round(transform.sceneX + (segment.x2 * transform.scaleX)),
    y2: Math.round(transform.sceneY + (segment.y2 * transform.scaleY)),
    kind: segment.kind
  };
}

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load scene image: ${src}`));
    image.src = src;
  });
}

function drawScaledImage(image, maxDimension) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvasElement = document.createElement("canvas");
  canvasElement.width = Math.max(1, Math.round(width * scale));
  canvasElement.height = Math.max(1, Math.round(height * scale));
  const context = canvasElement.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvasElement.width, canvasElement.height);
  return {
    imageData: context.getImageData(0, 0, canvasElement.width, canvasElement.height),
    scale
  };
}

function detectWallsFromImageData(imageData, options) {
  const { width, height, data } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = (0.299 * data[i]) + (0.587 * data[i + 1]) + (0.114 * data[i + 2]);
  }

  const localMean = boxBlurGray(gray, width, height, DEFAULTS.localRadius);
  const mask = buildStructureMask(gray, localMean, width, height, options);
  const grid = Math.max(8, options.gridSize);
  const minRunCells = readNumber(options.minRunCells, DEFAULTS.minRunCells);
  const mergeGapCells = readNumber(options.mergeGapCells, DEFAULTS.mergeGapCells);
  const minRun = Math.max(16, Math.round(grid * minRunCells));
  const mergeGap = Math.max(6, Math.round(grid * mergeGapCells));

  const rawSegments = [
    ...scanRuns(mask, width, height, "h", minRun),
    ...scanRuns(mask, width, height, "v", minRun)
  ];
  const snapped = rawSegments
    .map(segment => snapSegment(segment, grid, DEFAULTS.snapDivisions))
    .filter(segment => segmentLength(segment) >= minRun);
  const merged = suppressIsolatedShortSegments(mergeCollinear(snapped, mergeGap), grid);
  const cut = addDoorCuts(merged, gray, width, height, grid);
  return {
    walls: cut.filter(segment => segment.kind === "wall").map(segment => unscaleSegment(segment, options.scale)),
    doors: cut.filter(segment => segment.kind === "door").map(segment => unscaleSegment(segment, options.scale))
  };
}

function boxBlurGray(gray, width, height, radius) {
  const temp = new Float32Array(width * height);
  const output = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    for (let x = -radius; x <= radius; x += 1) {
      sum += gray[y * width + clamp(x, 0, width - 1)];
    }
    for (let x = 0; x < width; x += 1) {
      temp[y * width + x] = sum / ((radius * 2) + 1);
      sum -= gray[y * width + clamp(x - radius, 0, width - 1)];
      sum += gray[y * width + clamp(x + radius + 1, 0, width - 1)];
    }
  }
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let y = -radius; y <= radius; y += 1) {
      sum += temp[clamp(y, 0, height - 1) * width + x];
    }
    for (let y = 0; y < height; y += 1) {
      output[y * width + x] = sum / ((radius * 2) + 1);
      sum -= temp[clamp(y - radius, 0, height - 1) * width + x];
      sum += temp[clamp(y + radius + 1, 0, height - 1) * width + x];
    }
  }
  return output;
}

function buildStructureMask(gray, localMean, width, height, options = {}) {
  const darknessOffset = readNumber(options.darknessOffset, DEFAULTS.darknessOffset);
  const gradientThreshold = readNumber(options.gradientThreshold, DEFAULTS.gradientThreshold);
  const mask = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const gx = Math.abs(gray[index + 1] - gray[index - 1]);
      const gy = Math.abs(gray[index + width] - gray[index - width]);
      const darkLocal = gray[index] < localMean[index] - darknessOffset;
      const edge = Math.max(gx, gy) >= gradientThreshold;
      if (darkLocal || edge) mask[index] = 1;
    }
  }
  return mask;
}

function scanRuns(mask, width, height, orientation, minRun) {
  const segments = [];
  if (orientation === "h") {
    for (let y = 0; y < height; y += 1) {
      let start = null;
      for (let x = 0; x <= width; x += 1) {
        const active = x < width && mask[y * width + x];
        if (active && start === null) start = x;
        if ((!active || x === width) && start !== null) {
          if (x - start >= minRun) segments.push({ x1: start, y1: y, x2: x - 1, y2: y, kind: "wall" });
          start = null;
        }
      }
    }
  } else {
    for (let x = 0; x < width; x += 1) {
      let start = null;
      for (let y = 0; y <= height; y += 1) {
        const active = y < height && mask[y * width + x];
        if (active && start === null) start = y;
        if ((!active || y === height) && start !== null) {
          if (y - start >= minRun) segments.push({ x1: x, y1: start, x2: x, y2: y - 1, kind: "wall" });
          start = null;
        }
      }
    }
  }
  return segments;
}

function snapSegment(segment, grid, divisions) {
  const snap = value => Math.round(value / (grid / divisions)) * (grid / divisions);
  if (Math.abs(segment.y1 - segment.y2) <= Math.abs(segment.x1 - segment.x2)) {
    const y = snap((segment.y1 + segment.y2) / 2);
    return { x1: snap(segment.x1), y1: y, x2: snap(segment.x2), y2: y, kind: segment.kind };
  }
  const x = snap((segment.x1 + segment.x2) / 2);
  return { x1: x, y1: snap(segment.y1), x2: x, y2: snap(segment.y2), kind: segment.kind };
}

function mergeCollinear(segments, mergeGap) {
  const sorted = [...segments].sort((a, b) => {
    const ao = orientation(a);
    const bo = orientation(b);
    return ao.localeCompare(bo) || axis(a) - axis(b) || spanStart(a) - spanStart(b);
  });
  const merged = [];
  for (const segment of sorted) {
    const last = merged[merged.length - 1];
    if (
      last &&
      segment.kind === last.kind &&
      orientation(segment) === orientation(last) &&
      Math.abs(axis(segment) - axis(last)) <= 1 &&
      spanStart(segment) <= spanEnd(last) + mergeGap
    ) {
      if (orientation(segment) === "h") {
        last.x1 = Math.min(last.x1, segment.x1, segment.x2);
        last.x2 = Math.max(last.x1, last.x2, segment.x1, segment.x2);
      } else {
        last.y1 = Math.min(last.y1, segment.y1, segment.y2);
        last.y2 = Math.max(last.y1, last.y2, segment.y1, segment.y2);
      }
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

function suppressIsolatedShortSegments(segments, grid) {
  const shortLength = grid * 1.15;
  return segments.filter(segment => {
    if (segment.kind !== "wall" || segmentLength(segment) >= shortLength) return true;
    return segments.some(other => other !== segment && segmentsTouch(segment, other, grid * 0.35));
  });
}

function segmentsTouch(first, second, tolerance) {
  const points = [
    [first.x1, first.y1],
    [first.x2, first.y2]
  ];
  const otherPoints = [
    [second.x1, second.y1],
    [second.x2, second.y2]
  ];
  for (const [x1, y1] of points) {
    for (const [x2, y2] of otherPoints) {
      if (Math.hypot(x1 - x2, y1 - y2) <= tolerance) return true;
    }
  }
  return false;
}

function addDoorCuts(segments, gray, width, height, grid) {
  const output = [...segments];
  const candidates = [];
  const sourceMax = grid * 2.1;
  const phaseOffset = grid * 0.5;
  for (const segment of segments) {
    if (segment.kind !== "wall") continue;
    if (segmentLength(segment) < grid * 1.8 || segmentLength(segment) > sourceMax) continue;
    if (orientation(segment) === "h") {
      const y = segment.y1;
      const start = Math.min(segment.x1, segment.x2);
      const end = Math.max(segment.x1, segment.x2);
      const first = Math.round((start + phaseOffset) / grid) * grid - phaseOffset;
      for (let x = first; x + grid <= end + 3; x += grid) {
        if (x >= start - 3) candidates.push({ x1: x, y1: y, x2: x + grid, y2: y, kind: "door" });
      }
    } else {
      const x = segment.x1;
      const start = Math.min(segment.y1, segment.y2);
      const end = Math.max(segment.y1, segment.y2);
      const first = Math.round((start + phaseOffset) / grid) * grid - phaseOffset;
      for (let y = first; y + grid <= end + 3; y += grid) {
        if (y >= start - 3) candidates.push({ x1: x, y1: y, x2: x, y2: y + grid, kind: "door" });
      }
    }
  }

  for (const candidate of candidates) {
    const stats = bandStats(gray, width, height, candidate);
    if (stats.mean < DEFAULTS.doorMeanMin || stats.mean > DEFAULTS.doorMeanMax || stats.std < DEFAULTS.doorStdMin) continue;
    const index = output.findIndex(segment => segment.kind === "wall" && contains(segment, candidate));
    if (index === -1) continue;
    const wall = output[index];
    output.splice(index, 1, ...splitWall(wall, candidate), candidate);
  }
  return output;
}

function bandStats(gray, width, height, segment) {
  const values = [];
  const half = 4;
  if (orientation(segment) === "h") {
    const y = Math.round(segment.y1);
    for (let yy = Math.max(0, y - half); yy <= Math.min(height - 1, y + half); yy += 1) {
      for (let x = Math.max(0, Math.round(Math.min(segment.x1, segment.x2))); x <= Math.min(width - 1, Math.round(Math.max(segment.x1, segment.x2))); x += 1) {
        values.push(gray[yy * width + x]);
      }
    }
  } else {
    const x = Math.round(segment.x1);
    for (let y = Math.max(0, Math.round(Math.min(segment.y1, segment.y2))); y <= Math.min(height - 1, Math.round(Math.max(segment.y1, segment.y2))); y += 1) {
      for (let xx = Math.max(0, x - half); xx <= Math.min(width - 1, x + half); xx += 1) {
        values.push(gray[y * width + xx]);
      }
    }
  }
  if (!values.length) return { mean: 0, std: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

function contains(wall, span) {
  if (orientation(wall) !== orientation(span)) return false;
  if (Math.abs(axis(wall) - axis(span)) > 3) return false;
  return spanStart(wall) <= spanStart(span) + 3 && spanEnd(wall) >= spanEnd(span) - 3;
}

function splitWall(wall, door) {
  const pieces = [];
  if (orientation(wall) === "h") {
    const y = wall.y1;
    const start = spanStart(wall);
    const end = spanEnd(wall);
    if (spanStart(door) > start) pieces.push({ x1: start, y1: y, x2: spanStart(door), y2: y, kind: "wall" });
    if (end > spanEnd(door)) pieces.push({ x1: spanEnd(door), y1: y, x2: end, y2: y, kind: "wall" });
  } else {
    const x = wall.x1;
    const start = spanStart(wall);
    const end = spanEnd(wall);
    if (spanStart(door) > start) pieces.push({ x1: x, y1: start, x2: x, y2: spanStart(door), kind: "wall" });
    if (end > spanEnd(door)) pieces.push({ x1: x, y1: spanEnd(door), x2: x, y2: end, kind: "wall" });
  }
  return pieces;
}

function renderPreview(detection) {
  clearPreview();
  previewContainer = new PIXI.Container();
  previewContainer.name = `${MODULE_ID}-preview`;
  const graphics = new PIXI.Graphics();
  previewContainer.addChild(graphics);
  canvas.stage.addChild(previewContainer);

  graphics.lineStyle(3, 0x2ea8ff, 0.85);
  for (const wall of detection.walls) graphics.moveTo(wall.x1, wall.y1).lineTo(wall.x2, wall.y2);
  graphics.lineStyle(5, 0xffb000, 0.95);
  for (const door of detection.doors) graphics.moveTo(door.x1, door.y1).lineTo(door.x2, door.y2);
}

function clearPreview() {
  if (previewContainer) {
    previewContainer.destroy({ children: true });
    previewContainer = null;
  }
}

async function applyLastDetection() {
  if (!lastDetection) throw new Error("No Auto Walls preview has been generated.");
  if (lastDetection.sceneId !== canvas.scene.id) throw new Error("The preview belongs to a different scene.");
  const documents = [
    ...lastDetection.walls.map(segment => wallDocument(segment, false)),
    ...lastDetection.doors.map(segment => wallDocument(segment, true))
  ];
  if (!documents.length) {
    ui.notifications.warn("Auto Walls did not find any walls to apply.");
    return [];
  }
  const created = await canvas.scene.createEmbeddedDocuments("Wall", documents);
  ui.notifications.info(`Auto Walls applied ${created.length} wall documents.`);
  return created;
}

function wallDocument(segment, isDoor) {
  return {
    c: [Math.round(segment.x1), Math.round(segment.y1), Math.round(segment.x2), Math.round(segment.y2)],
    move: 1,
    sight: 1,
    sound: 1,
    door: isDoor ? 1 : 0,
    ds: isDoor ? 1 : 0
  };
}

function unscaleSegment(segment, scale) {
  const factor = scale > 0 ? 1 / scale : 1;
  return {
    x1: Math.round(segment.x1 * factor),
    y1: Math.round(segment.y1 * factor),
    x2: Math.round(segment.x2 * factor),
    y2: Math.round(segment.y2 * factor),
    kind: segment.kind
  };
}

function orientation(segment) {
  return Math.abs(segment.x2 - segment.x1) >= Math.abs(segment.y2 - segment.y1) ? "h" : "v";
}

function axis(segment) {
  return orientation(segment) === "h" ? segment.y1 : segment.x1;
}

function spanStart(segment) {
  return orientation(segment) === "h" ? Math.min(segment.x1, segment.x2) : Math.min(segment.y1, segment.y2);
}

function spanEnd(segment) {
  return orientation(segment) === "h" ? Math.max(segment.x1, segment.x2) : Math.max(segment.y1, segment.y2);
}

function segmentLength(segment) {
  return Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function reportError(error) {
  console.error(`${MODULE_ID} |`, error);
  ui.notifications.error(error.message ?? String(error));
}

function findSceneControl(controls, name) {
  if (Array.isArray(controls)) return controls.find(control => control.name === name);
  return controls?.[name] ?? Object.values(controls ?? {}).find(control => control.name === name);
}

function firstSceneControl(controls) {
  if (Array.isArray(controls)) return controls[0];
  return Object.values(controls ?? {})[0];
}

function getSceneControlTools(control) {
  if (!control) return null;
  if (Array.isArray(control.tools)) return control.tools;
  if (control.tools && typeof control.tools === "object") return control.tools;
  return null;
}

function getSceneControlToolCount(tools) {
  return Array.isArray(tools) ? tools.length : Object.keys(tools ?? {}).length;
}

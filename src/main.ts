import { invoke } from "@tauri-apps/api/core";
import { desktopDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { check } from "@tauri-apps/plugin-updater";

import { en } from "./i18n/en";
import { ptBR } from "./i18n/pt-BR";

import { track } from "./telemetry";

const translations = {
  en,
  "pt-BR": ptBR,
} as const;

type Language = keyof typeof translations;

function detectLanguage(): Language {
  const browserLanguage = navigator.language.toLowerCase();

  return browserLanguage.startsWith("pt-br")
    ? "pt-BR"
    : "en";
}

let currentLanguage: Language = detectLanguage();

void track("app_opened");

function t(
  key: keyof typeof en,
  replacements?: Record<string, string | number>,
): string {
  let value: string =
    translations[currentLanguage][key];

  if (replacements) {
    for (const [placeholder, replacement] of Object.entries(
      replacements,
    )) {
      value = value.replace(
        `{${placeholder}}`,
        String(replacement),
      );
    }
  }

  return value;
}

function formatNumber(value: number): string {
  return value.toLocaleString(currentLanguage);
}

interface FileSystemItem {
  name: string;
  path: string;
  kind: "file" | "directory";
  extension: string | null;
  size: number;
  created_at: string | null;
  modified_at: string | null;
  parent_path: string | null;
}

interface ScanResult {
  location: string;
  items: FileSystemItem[];
  total_files: number;
  total_directories: number;
  total_size: number;
}

interface WorkspaceScan {
  locations: ScanResult[];
}

interface OrganizationOperation {
  operation_type: "create_directory" | "move" | "rename";
  status: "ready" | "conflict";
  source: string | null;
  destination: string;
  reason: string;
}

interface OrganizationSummary {
  files_to_move: number;
  files_to_rename: number;
  directories_to_create: number;
}

interface OrganizationPlan {
  source: string;
  operations: OrganizationOperation[];
  summary: OrganizationSummary;
}

interface OperationExecutionResult {
  operation_type: "create_directory" | "move" | "rename";
  status: "executed" | "skipped" | "failed";
  source: string | null;
  destination: string;
  message: string;
}

interface ExecutionResult {
  total: number;
  executed: number;
  skipped: number;
  failed: number;
  operations: OperationExecutionResult[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(
    Math.log(bytes) / Math.log(1024),
  );

  return `${(
    bytes / Math.pow(1024, index)
  ).toFixed(2)} ${units[index]}`;
}

function getLocationName(path: string): string {
  const normalizedPath = path
    .replace(/\\/g, "/")
    .replace(/\/$/, "");

  const parts = normalizedPath.split("/");

  return parts[parts.length - 1] || path;
}

function getDestinationFolder(path: string): string {
  const normalizedPath = path
    .replace(/\\/g, "/")
    .replace(/\/$/, "");

  const parts = normalizedPath.split("/");

  return parts[parts.length - 2] || path;
}

function getFileName(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/");
  const parts = normalizedPath.split("/");

  return parts[parts.length - 1] || path;
}

function normalizePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/\/$/, "")
    .toLowerCase();
}

function buildDirectoryTree(
  scan: ScanResult,
): string {
  const rootName = getLocationName(scan.location);

  const childrenByParent = new Map<
    string,
    FileSystemItem[]
  >();

  for (const item of scan.items) {
    if (!item.parent_path) {
      continue;
    }

    const parentKey = normalizePath(item.parent_path);
    const children =
      childrenByParent.get(parentKey) || [];

    children.push(item);
    childrenByParent.set(parentKey, children);
  }

  for (const children of childrenByParent.values()) {
    children.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === "directory" ? -1 : 1;
      }

      return a.name.localeCompare(
        b.name,
        currentLanguage,
      );
    });
  }

  const lines: string[] = [rootName];

  function appendChildren(
    parentPath: string,
    prefix: string,
  ): void {
    const children =
      childrenByParent.get(
        normalizePath(parentPath),
      ) || [];

    children.forEach((item, index) => {
      const isLast =
        index === children.length - 1;

      const branch = isLast
        ? "└── "
        : "├── ";

      const childPrefix = isLast
        ? "    "
        : "│   ";

      lines.push(
        `${prefix}${branch}${item.name}`,
      );

      if (item.kind === "directory") {
        appendChildren(
          item.path,
          `${prefix}${childPrefix}`,
        );
      }
    });
  }

  appendChildren(scan.location, "");

  return lines.join("\n");
}

async function copySelectedDirectoryStructure(): Promise<void> {
  if (!selectedDirectoryScan) {
    return;
  }

  const structure = buildDirectoryTree(
    selectedDirectoryScan,
  );

  try {
    await navigator.clipboard.writeText(
      structure,
    );

    const appStatusEl =
      document.querySelector("#app-status");

    if (appStatusEl) {
      appStatusEl.textContent = t(
        "copyStructureSuccess",
      );
    }

    console.log(
      t("structureCopied"),
      structure,
    );
  } catch (error) {
    console.error(
      t("copyStructureError"),
      error,
    );

    window.alert(
      t("copyStructureFailed"),
    );
  }
}

let currentWorkspaceScan:
  | WorkspaceScan
  | null = null;

let selectedDirectory: string | null = null;

let selectedDirectoryScan:
  | ScanResult
  | null = null;

let currentOrganizationPlan:
  | OrganizationPlan
  | null = null;

function createLocationCard(
  location: ScanResult,
  type: "tracked" | "selected",
  status?: string,
): HTMLElement {
  const card =
    document.createElement("article");

  card.className = "location-card";

  if (
    type === "selected" &&
    !location.location
  ) {
    card.innerHTML = `
      <div class="location-header">
        <div>
          <span class="section-eyebrow">
            ${t("selectedFolder")}
          </span>

          <h3>${t("noFolderSelected")}</h3>
        </div>
      </div>

      <p class="location-empty">
        ${t("chooseFolderDescription")}
      </p>
    `;

    return card;
  }

  const eyebrow =
    type === "tracked"
      ? t("trackedLocation")
      : t("selectedLocation");

  const statusHtml = status
    ? `
      <div class="location-status">
        ${status}
      </div>
    `
    : "";

  const structureButton =
    type === "selected"
      ? `
        <div class="location-actions">
          <button id="copy-structure-button" type="button">
            ${t("copyStructure")}
          </button>
        </div>
      `
      : "";

  card.innerHTML = `
    <div class="location-header">
      <div>
        <span class="section-eyebrow">
          ${eyebrow}
        </span>

        <h3>
          ${getLocationName(location.location)}
        </h3>
      </div>

      <span class="location-path">
        ${location.location}
      </span>
    </div>

    <div class="location-stats">
      <div>
        <strong>
          ${formatNumber(location.total_files)}
        </strong>

        <span>${t("files")}</span>
      </div>

      <div>
        <strong>
          ${formatNumber(
    location.total_directories,
  )}
        </strong>

        <span>${t("folders")}</span>
      </div>

      <div>
        <strong>
          ${formatBytes(location.total_size)}
        </strong>

        <span>${t("occupied")}</span>
      </div>
    </div>

    ${statusHtml}

    ${structureButton}
  `;

  if (type === "selected") {
    const copyButton =
      card.querySelector<HTMLButtonElement>(
        "#copy-structure-button",
      );

    copyButton?.addEventListener(
      "click",
      copySelectedDirectoryStructure,
    );
  }

  return card;
}

function renderWorkspace(): void {
  const workspaceEl =
    document.querySelector("#workspace");

  if (
    !workspaceEl ||
    !currentWorkspaceScan
  ) {
    return;
  }

  workspaceEl.innerHTML = "";

  const desktopLocation =
    currentWorkspaceScan.locations[0];

  if (desktopLocation) {
    workspaceEl.appendChild(
      createLocationCard(
        desktopLocation,
        "tracked",
      ),
    );
  }

  if (selectedDirectoryScan) {
    let status: string;

    if (currentOrganizationPlan) {
      const hasChanges =
        currentOrganizationPlan.summary
          .files_to_move > 0 ||
        currentOrganizationPlan.summary
          .files_to_rename > 0 ||
        currentOrganizationPlan.summary
          .directories_to_create > 0;

      status = hasChanges
        ? t("analysisCompleted")
        : t("everythingOrganized");
    } else {
      status = t("selectedFolderStatus");
    }

    workspaceEl.appendChild(
      createLocationCard(
        selectedDirectoryScan,
        "selected",
        status,
      ),
    );
  } else {
    workspaceEl.appendChild(
      createLocationCard(
        {
          location: "",
          items: [],
          total_files: 0,
          total_directories: 0,
          total_size: 0,
        },
        "selected",
      ),
    );
  }
}

function renderOrganizationPlan(
  plan: OrganizationPlan,
): void {
  currentOrganizationPlan = plan;

  const planEl =
    document.querySelector(
      "#organization-plan",
    );

  if (!planEl) {
    return;
  }

  planEl.innerHTML = "";

  const moveOperations =
    plan.operations.filter(
      (operation) =>
        operation.operation_type === "move",
    );

  const conflictOperations =
    moveOperations.filter(
      (operation) =>
        operation.status === "conflict",
    );

  const hasChanges =
    plan.summary.files_to_move > 0 ||
    plan.summary.files_to_rename > 0 ||
    plan.summary.directories_to_create > 0;

  renderWorkspace();

  if (!hasChanges) {
    const emptyState =
      document.createElement("section");

    emptyState.className =
      "organization-summary";

    emptyState.innerHTML = `
      <div class="plan-intro">
        <span class="section-eyebrow">
          ${t("everythingOrganized")}
        </span>

        <h2>${t("noChangesTitle")}</h2>

        <p>
          ${t("noChangesDescription")}
        </p>
      </div>

      <div class="plan-metrics">
        <div class="metric-card">
          <strong>0</strong>
          <span>${t("filesToOrganize")}</span>
        </div>

        <div class="metric-card">
          <strong>0</strong>
          <span>${t("newFolders")}</span>
        </div>

        <div class="metric-card">
          <strong>0</strong>
          <span>${t("conflictsFound")}</span>
        </div>
      </div>
    `;

    planEl.appendChild(emptyState);

    return;
  }

  const folderCounts =
    new Map<string, number>();

  for (const operation of moveOperations) {
    const folder =
      getDestinationFolder(
        operation.destination,
      );

    folderCounts.set(
      folder,
      (folderCounts.get(folder) || 0) + 1,
    );
  }

  const sortedFolders =
    Array.from(folderCounts.entries()).sort(
      (a, b) => b[1] - a[1],
    );

  const summary =
    document.createElement("section");

  summary.className =
    "organization-summary";

  summary.innerHTML = `
    <div class="plan-intro">
      <span class="section-eyebrow">
        ${t("organizationSuggestion")}
      </span>

      <h2>
        ${t("organizationSuggestionTitle")}
      </h2>

      <p>
        ${t("organizationSuggestionDescription")}
      </p>
    </div>

    <div class="plan-metrics">
      <div class="metric-card">
        <strong>
          ${formatNumber(
    plan.summary.files_to_move,
  )}
        </strong>

        <span>${t("filesToOrganize")}</span>
      </div>

      <div class="metric-card">
        <strong>
          ${formatNumber(
    plan.summary.directories_to_create,
  )}
        </strong>

        <span>${t("newFolders")}</span>
      </div>

      <div class="metric-card ${conflictOperations.length > 0
      ? "attention"
      : ""
    }">
        <strong>
          ${formatNumber(
      conflictOperations.length,
    )}
        </strong>

        <span>${t("conflictsFound")}</span>
      </div>
    </div>

    <div class="organization-groups">
      <div class="groups-header">
        <div>
          <span class="section-eyebrow">
            ${t("summary")}
          </span>

          <h3>
            ${t("howFilesWouldBeOrganized")}
          </h3>
        </div>
      </div>

      <div class="folder-grid">
        ${sortedFolders
      .map(
        ([folder, count]) => `
              <div class="folder-card">
                <span class="folder-icon">↳</span>

                <div>
                  <strong>${folder}</strong>

                  <span>
                    ${formatNumber(count)}
                    ${count === 1
            ? t("file")
            : t("files")
          }
                  </span>
                </div>
              </div>
            `,
      )
      .join("")}
      </div>
    </div>

    ${conflictOperations.length > 0
      ? `
          <div class="attention-panel">
            <div>
              <strong>
                ⚠️
                ${conflictOperations.length}
                ${conflictOperations.length ===
        1
        ? t("attentionItem")
        : t("attentionItems")
      }
                ${t("attention")}
              </strong>

              <p>
                ${t("attentionDescription")}
              </p>
            </div>
          </div>
        `
      : ""
    }

    <div class="plan-actions">
      <button
        id="review-plan-button"
        type="button"
      >
        ${t("reviewOrganization")}
      </button>

      <button
        id="execute-plan-button"
        type="button"
        ${conflictOperations.length > 0
      ? "disabled"
      : ""
    }
      >
        ${t("organizeFiles")}
      </button>

      <span>
        ${conflictOperations.length > 0
      ? t("resolveConflicts")
      : t("confirmationNotice")
    }
      </span>
    </div>
  `;

  planEl.appendChild(summary);

  const reviewSection =
    document.createElement("section");

  reviewSection.className =
    "review-section";

  reviewSection.id =
    "review-section";

  reviewSection.innerHTML = `
    <div class="review-header">
      <span class="section-eyebrow">
        ${t("details")}
      </span>

      <h3>
        ${t("proposedOperations")}
      </h3>

      <p>
        ${t("reviewDescription")}
      </p>
    </div>
  `;

  const operationsList =
    document.createElement("div");

  operationsList.className =
    "operations-list";

  const operationsByFolder =
    new Map<
      string,
      OrganizationOperation[]
    >();

  for (const operation of moveOperations) {
    const folder =
      getDestinationFolder(
        operation.destination,
      );

    const operations =
      operationsByFolder.get(folder) || [];

    operations.push(operation);

    operationsByFolder.set(
      folder,
      operations,
    );
  }

  const orderedFolders =
    Array.from(
      operationsByFolder.entries(),
    ).sort(
      (a, b) =>
        b[1].length - a[1].length,
    );

  if (
    plan.summary.directories_to_create >
    0
  ) {
    const directories =
      plan.operations.filter(
        (operation) =>
          operation.operation_type ===
          "create_directory",
      );

    const directoryCard =
      document.createElement("article");

    directoryCard.className =
      "operation-group directory-group";

    directoryCard.innerHTML = `
      <div class="operation-group-header">
        <div>
          <span class="group-icon">+</span>

          <div>
            <strong>
              ${t("newFoldersLabel")}
            </strong>

            <span>
              ${formatNumber(
      directories.length,
    )}
              ${directories.length === 1
        ? t("folderWillBeCreated")
        : t("foldersWillBeCreated")
      }
            </span>
          </div>
        </div>

        <span class="group-status">
          ${t("ready")}
        </span>
      </div>

      <div class="operation-group-content">
        ${directories
        .map(
          (operation) => `
              <div class="directory-item">
                <span>↳</span>
                <span>
                  ${operation.destination}
                </span>
              </div>
            `,
        )
        .join("")}
      </div>
    `;

    operationsList.appendChild(
      directoryCard,
    );
  }

  for (
    const [folder, operations]
    of orderedFolders
  ) {
    const group =
      document.createElement("details");

    group.className =
      "operation-group";

    const groupConflicts =
      operations.filter(
        (operation) =>
          operation.status === "conflict",
      ).length;

    const statusLabel =
      groupConflicts > 0
        ? `⚠️ ${formatNumber(
          groupConflicts,
        )} ${groupConflicts === 1
          ? t("conflict")
          : t("conflicts")
        }`
        : t("ready");

    group.innerHTML = `
      <summary class="operation-group-header">
        <div>
          <span class="group-icon">↳</span>

          <div>
            <strong>${folder}</strong>

            <span>
              ${formatNumber(
      operations.length,
    )}
              ${operations.length === 1
        ? t("file")
        : t("files")
      }
            </span>
          </div>
        </div>

        <span
          class="group-status ${groupConflicts > 0
        ? "conflict"
        : ""
      }"
        >
          ${statusLabel}
        </span>
      </summary>

      <div class="operation-group-content">
        ${operations
        .map(
          (operation) => `
              <div
                class="file-operation ${operation.status ===
              "conflict"
              ? "conflict"
              : ""
            }"
              >
                <div class="file-operation-header">
                  <strong>
                    ${operation.status ===
              "conflict"
              ? "⚠️"
              : "✓"
            }

                    ${getFileName(
              operation.source ||
              t("fileLabel"),
            )}
                  </strong>

                  <span>
                    ${operation.status ===
              "conflict"
              ? t("conflictTitle")
              : t("readyTitle")
            }
                  </span>
                </div>

                ${operation.status ===
              "conflict"
              ? `<p>${operation.reason}</p>`
              : ""
            }
              </div>
            `,
        )
        .join("")}
      </div>
    `;

    operationsList.appendChild(group);
  }

  reviewSection.appendChild(
    operationsList,
  );

  planEl.appendChild(reviewSection);

  const reviewButton =
    document.querySelector(
      "#review-plan-button",
    );

  reviewButton?.addEventListener(
    "click",
    () => {
      reviewSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
  );

  const executeButton =
    document.querySelector<HTMLButtonElement>(
      "#execute-plan-button",
    );

  executeButton?.addEventListener(
    "click",
    async () => {
      if (!currentOrganizationPlan) {
        return;
      }

      const confirmed =
        window.confirm(
          t("confirmOrganization", {
            files:
              currentOrganizationPlan.summary
                .files_to_move,
            folders:
              currentOrganizationPlan.summary
                .directories_to_create,
          }),
        );

      if (!confirmed) {
        return;
      }

      executeButton.disabled = true;

      executeButton.textContent =
        t("organizing");

      try {
        const result =
          await invoke<ExecutionResult>(
            "execute_organization_plan",
            {
              plan:
                currentOrganizationPlan,
            },
          );

        void track("organization_executed", {
          total: result.total,
          executed: result.executed,
          skipped: result.skipped,
          failed: result.failed,
        });

        console.log(
          t("executionResult"),
          result,
        );

        if (result.failed > 0) {
          window.alert(
            `${t("executionPartial")}\n\n` +
            `${t("executed")} ${result.executed}\n` +
            `${t("skipped")} ${result.skipped}\n` +
            `${t("failed")} ${result.failed}`,
          );
        } else {
          window.alert(
            `${t("executionSuccess")}\n\n` +
            `${result.executed} ${t(
              "operationsExecuted",
            )}`,
          );
        }

        if (selectedDirectory) {
          selectedDirectoryScan =
            await invoke<ScanResult>(
              "scan_directory",
              {
                path:
                  selectedDirectory,
              },
            );

          renderWorkspace();
        }
      } catch (error) {
        void track("organization_failed");

        console.error(
          t("executionError"),
          error,
        );

        window.alert(
          t("executionFailed"),
        );
      } finally {
        executeButton.disabled = false;

        executeButton.textContent =
          t("organizeFiles");
      }
    },
  );
}

async function chooseDirectory(): Promise<void> {
  const selectedPath =
    await open({
      directory: true,
      multiple: false,
      title: t("chooseFolder"),
    });

  if (
    typeof selectedPath !== "string"
  ) {
    return;
  }

  selectedDirectory =
    selectedPath;

  selectedDirectoryScan = null;
  currentOrganizationPlan = null;

  const selectedDirectoryEl =
    document.querySelector(
      "#selected-directory",
    );

  if (selectedDirectoryEl) {
    selectedDirectoryEl.textContent =
      selectedPath;
  }

  const planEl =
    document.querySelector(
      "#organization-plan",
    );

  if (planEl) {
    planEl.innerHTML = "";
  }

  try {
    selectedDirectoryScan =
      await invoke<ScanResult>(
        "scan_directory",
        {
          path: selectedPath,
        },
      );

    void track("scan_completed", {
      total_files:
        selectedDirectoryScan.total_files,
      total_directories:
        selectedDirectoryScan.total_directories,
      total_size:
        selectedDirectoryScan.total_size,
    });
  } catch (error) {
    void track("scan_failed");
    console.error(
      t("scanSelectedFolderError"),
      error,
    );

    window.alert(
      t("loadWorkspaceFailed"),
    );

    return;
  }

  renderWorkspace();

  console.log(
    t("selectedFolderLabel"),
    selectedPath,
  );
}

async function analyzeSelectedDirectory(): Promise<void> {
  if (!selectedDirectory) {
    window.alert(
      t("chooseFolderFirst"),
    );

    return;
  }

  const analyzeButton =
    document.querySelector<HTMLButtonElement>(
      "#analyze-directory-button",
    );

  if (analyzeButton) {
    analyzeButton.disabled = true;

    analyzeButton.textContent =
      t("analyzing");
  }

  try {
    const organizationPlan =
      await invoke<OrganizationPlan>(
        "plan_directory_organization",
        {
          path:
            selectedDirectory,
        },
      );

    void track("plan_created", {
      files_to_move:
        organizationPlan.summary.files_to_move,
      files_to_rename:
        organizationPlan.summary.files_to_rename,
      directories_to_create:
        organizationPlan.summary.directories_to_create,
    });

    selectedDirectoryScan =
      await invoke<ScanResult>(
        "scan_directory",
        {
          path:
            selectedDirectory,
        },
      );

    renderOrganizationPlan(
      organizationPlan,
    );
  } catch (error) {
    void track("plan_failed");

    console.error(
      t("analyzeDirectoryError"),
      error,
    );

    window.alert(
      t("analyzeFolderFailed"),
    );
  } finally {
    if (analyzeButton) {
      analyzeButton.disabled = false;

      analyzeButton.textContent =
        t("analyzeFolder");
    }
  }
}

async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();

    if (!update) {
      window.alert(
        t("latestVersion"),
      );

      return;
    }

    const confirmed =
      window.confirm(
        `${t("updateAvailable")}\n\n` +
        `${t("currentVersion")} ${update.currentVersion
        }\n\n` +
        `${update.body ||
        t("updateBodyFallback")
        }\n\n` +
        `${t("installUpdate")}`,
      );

    if (!confirmed) {
      await update.close();
      return;
    }

    await update.downloadAndInstall();
  } catch (error) {
    console.error(
      t("updateCheckError"),
      error,
    );

    window.alert(
      t("updateCheckFailed"),
    );
  }
}

window.addEventListener(
  "DOMContentLoaded",
  async () => {
    const chooseDirectoryButton =
      document.querySelector<HTMLButtonElement>(
        "#choose-directory-button",
      );

    chooseDirectoryButton?.addEventListener(
      "click",
      chooseDirectory,
    );

    const analyzeDirectoryButton =
      document.querySelector<HTMLButtonElement>(
        "#analyze-directory-button",
      );

    const checkUpdatesButton =
      document.querySelector<HTMLButtonElement>(
        "#check-updates-button",
      );

    checkUpdatesButton?.addEventListener(
      "click",
      checkForUpdates,
    );

    analyzeDirectoryButton?.addEventListener(
      "click",
      analyzeSelectedDirectory,
    );

    try {
      const appInfo =
        await invoke("get_app_info");

      const desktop =
        await desktopDir();

      currentWorkspaceScan =
        await invoke<WorkspaceScan>(
          "scan_workspace",
          {
            paths: [desktop],
          },
        );

      const appStatusEl =
        document.querySelector(
          "#app-status",
        );

      if (appStatusEl) {
        appStatusEl.textContent =
          `🟢 ${appInfo as string} ${t(
            "appReady",
          )}`;
      }

      renderWorkspace();
    } catch (error) {
      console.error(
        t("appLoadError"),
        error,
      );

      const appStatusEl =
        document.querySelector(
          "#app-status",
        );

      if (appStatusEl) {
        appStatusEl.textContent =
          t("workspaceLoadFailed");
      }
    }
  },
);
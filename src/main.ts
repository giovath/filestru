import { invoke } from "@tauri-apps/api/core";
import { desktopDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";

import { check } from "@tauri-apps/plugin-updater";

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
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

function getLocationName(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/").replace(/\/$/, "");
  const parts = normalizedPath.split("/");

  return parts[parts.length - 1] || path;
}

function getDestinationFolder(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/").replace(/\/$/, "");
  const parts = normalizedPath.split("/");

  return parts[parts.length - 2] || path;
}

function getFileName(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/");
  const parts = normalizedPath.split("/");

  return parts[parts.length - 1] || path;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
}

function buildDirectoryTree(scan: ScanResult): string {
  const rootName = getLocationName(scan.location);

  const childrenByParent = new Map<string, FileSystemItem[]>();

  for (const item of scan.items) {
    if (!item.parent_path) {
      continue;
    }

    const parentKey = normalizePath(item.parent_path);
    const children = childrenByParent.get(parentKey) || [];

    children.push(item);
    childrenByParent.set(parentKey, children);
  }

  for (const children of childrenByParent.values()) {
    children.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === "directory" ? -1 : 1;
      }

      return a.name.localeCompare(b.name, "pt-BR");
    });
  }

  const lines: string[] = [rootName];

  function appendChildren(parentPath: string, prefix: string): void {
    const children =
      childrenByParent.get(normalizePath(parentPath)) || [];

    children.forEach((item, index) => {
      const isLast = index === children.length - 1;
      const branch = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";

      lines.push(`${prefix}${branch}${item.name}`);

      if (item.kind === "directory") {
        appendChildren(
          item.path,
          `${prefix}${childPrefix}`
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
    selectedDirectoryScan
  );

  try {
    await navigator.clipboard.writeText(structure);

    const appStatusEl =
      document.querySelector("#app-status");

    if (appStatusEl) {
      appStatusEl.textContent =
        "📋 Estrutura copiada para a área de transferência";
    }

    console.log(
      "Estrutura copiada:",
      structure
    );
  } catch (error) {
    console.error(
      "Erro ao copiar estrutura:",
      error
    );

    window.alert(
      "❌ Não foi possível copiar a estrutura para a área de transferência."
    );
  }
}

let currentWorkspaceScan: WorkspaceScan | null = null;
let selectedDirectory: string | null = null;
let selectedDirectoryScan: ScanResult | null = null;
let currentOrganizationPlan: OrganizationPlan | null = null;

function createLocationCard(
  location: ScanResult,
  type: "tracked" | "selected",
  status?: string
): HTMLElement {
  const card = document.createElement("article");

  card.className = "location-card";

  if (type === "selected" && !location.location) {
    card.innerHTML = `
      <div class="location-header">
        <div>
          <span class="section-eyebrow">📂 Pasta selecionada</span>
          <h3>Nenhuma pasta selecionada</h3>
        </div>
      </div>

      <p class="location-empty">
        Escolha uma pasta acima para analisar e organizar seus arquivos.
      </p>
    `;

    return card;
  }

  const eyebrow =
    type === "tracked"
      ? "📍 Local acompanhado"
      : "📂 Pasta selecionada";

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
            📋 Copiar estrutura
          </button>
        </div>
      `
      : "";

  card.innerHTML = `
    <div class="location-header">
      <div>
        <span class="section-eyebrow">${eyebrow}</span>
        <h3>${getLocationName(location.location)}</h3>
      </div>

      <span class="location-path">${location.location}</span>
    </div>

    <div class="location-stats">
      <div>
        <strong>${location.total_files.toLocaleString("pt-BR")}</strong>
        <span>arquivos</span>
      </div>

      <div>
        <strong>${location.total_directories.toLocaleString("pt-BR")}</strong>
        <span>pastas</span>
      </div>

      <div>
        <strong>${formatBytes(location.total_size)}</strong>
        <span>ocupado</span>
      </div>
    </div>

    ${statusHtml}

    ${structureButton}
  `;

  if (type === "selected") {
    const copyButton =
      card.querySelector<HTMLButtonElement>(
        "#copy-structure-button"
      );

    copyButton?.addEventListener(
      "click",
      copySelectedDirectoryStructure
    );
  }

  return card;
}

function renderWorkspace(): void {
  const workspaceEl = document.querySelector("#workspace");

  if (!workspaceEl || !currentWorkspaceScan) {
    return;
  }

  workspaceEl.innerHTML = "";

  const desktopLocation =
    currentWorkspaceScan.locations[0];

  if (desktopLocation) {
    workspaceEl.appendChild(
      createLocationCard(
        desktopLocation,
        "tracked"
      )
    );
  }

  if (selectedDirectoryScan) {
    let status: string;

    if (currentOrganizationPlan) {
      const hasChanges =
        currentOrganizationPlan.summary.files_to_move > 0 ||
        currentOrganizationPlan.summary.files_to_rename > 0 ||
        currentOrganizationPlan.summary.directories_to_create > 0;

      status = hasChanges
        ? "🔎 Análise concluída"
        : "✅ Tudo organizado";
    } else {
      status = "📁 Pasta selecionada";
    }

    workspaceEl.appendChild(
      createLocationCard(
        selectedDirectoryScan,
        "selected",
        status
      )
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
        "selected"
      )
    );
  }
}

function renderOrganizationPlan(
  plan: OrganizationPlan
): void {
  currentOrganizationPlan = plan;

  const planEl =
    document.querySelector("#organization-plan");

  if (!planEl) {
    return;
  }

  planEl.innerHTML = "";

  const moveOperations =
    plan.operations.filter(
      (operation) =>
        operation.operation_type === "move"
    );

  const conflictOperations =
    moveOperations.filter(
      (operation) =>
        operation.status === "conflict"
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
        <span class="section-eyebrow">✅ Tudo organizado</span>

        <h2>Nenhuma alteração necessária.</h2>

        <p>
          O FileStru analisou esta pasta e não encontrou arquivos
          que precisem ser reorganizados.
        </p>
      </div>

      <div class="plan-metrics">
        <div class="metric-card">
          <strong>0</strong>
          <span>arquivos para organizar</span>
        </div>

        <div class="metric-card">
          <strong>0</strong>
          <span>pastas novas</span>
        </div>

        <div class="metric-card">
          <strong>0</strong>
          <span>conflitos encontrados</span>
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
        operation.destination
      );

    folderCounts.set(
      folder,
      (folderCounts.get(folder) || 0) + 1
    );
  }

  const sortedFolders =
    Array.from(folderCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    );

  const summary =
    document.createElement("section");

  summary.className =
    "organization-summary";

  summary.innerHTML = `
    <div class="plan-intro">
      <span class="section-eyebrow">🧠 Sugestão de organização</span>

      <h2>Encontramos uma forma de organizar esta pasta.</h2>

      <p>
        O FileStru analisou os arquivos e preparou uma sugestão.
        Nenhum arquivo será alterado sem sua confirmação.
      </p>
    </div>

    <div class="plan-metrics">
      <div class="metric-card">
        <strong>${plan.summary.files_to_move.toLocaleString("pt-BR")}</strong>
        <span>arquivos para organizar</span>
      </div>

      <div class="metric-card">
        <strong>${plan.summary.directories_to_create.toLocaleString("pt-BR")}</strong>
        <span>pastas novas</span>
      </div>

      <div class="metric-card ${conflictOperations.length > 0
      ? "attention"
      : ""
    }">
        <strong>${conflictOperations.length.toLocaleString("pt-BR")}</strong>
        <span>conflitos encontrados</span>
      </div>
    </div>

    <div class="organization-groups">
      <div class="groups-header">
        <div>
          <span class="section-eyebrow">📋 Resumo</span>
          <h3>Como os arquivos seriam organizados</h3>
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
                    ${count.toLocaleString("pt-BR")}
                    ${count === 1
            ? "arquivo"
            : "arquivos"
          }
                  </span>
                </div>
              </div>
            `
      )
      .join("")}
      </div>
    </div>

    ${conflictOperations.length > 0
      ? `
          <div class="attention-panel">
            <div>
              <strong>
                ⚠️ ${conflictOperations.length}
                ${conflictOperations.length === 1
        ? "item precisa"
        : "itens precisam"
      }
                de atenção.
              </strong>

              <p>
                Existem arquivos no destino que precisam ser avaliados antes
                de qualquer execução.
              </p>
            </div>
          </div>
        `
      : ""
    }

    <div class="plan-actions">
      <button id="review-plan-button" type="button">
        🔎 Revisar organização
      </button>

      <button
        id="execute-plan-button"
        type="button"
        ${conflictOperations.length > 0
      ? "disabled"
      : ""
    }
      >
        ✨ Organizar arquivos
      </button>

      <span>
        ${conflictOperations.length > 0
      ? "⚠️ Resolva os conflitos antes de executar."
      : "🔒 Nenhum arquivo será alterado sem sua confirmação."
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
      <span class="section-eyebrow">🔎 Detalhamento</span>

      <h3>Operações propostas</h3>

      <p>
        Confira cada alteração antes que qualquer arquivo seja modificado.
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
        operation.destination
      );

    const operations =
      operationsByFolder.get(folder) || [];

    operations.push(operation);

    operationsByFolder.set(
      folder,
      operations
    );
  }

  const orderedFolders =
    Array.from(
      operationsByFolder.entries()
    ).sort(
      (a, b) =>
        b[1].length - a[1].length
    );

  if (
    plan.summary.directories_to_create > 0
  ) {
    const directories =
      plan.operations.filter(
        (operation) =>
          operation.operation_type ===
          "create_directory"
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
            <strong>📁 Pastas novas</strong>

            <span>
              ${directories.length.toLocaleString("pt-BR")}
              ${directories.length === 1
        ? "pasta será criada"
        : "pastas serão criadas"
      }
            </span>
          </div>
        </div>

        <span class="group-status">✓ Pronto</span>
      </div>

      <div class="operation-group-content">
        ${directories
        .map(
          (operation) => `
              <div class="directory-item">
                <span>↳</span>
                <span>${operation.destination}</span>
              </div>
            `
        )
        .join("")}
      </div>
    `;

    operationsList.appendChild(
      directoryCard
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
          operation.status === "conflict"
      ).length;

    const statusLabel =
      groupConflicts > 0
        ? `⚠️ ${groupConflicts} ${groupConflicts === 1
          ? "conflito"
          : "conflitos"
        }`
        : "✓ Pronto";

    group.innerHTML = `
      <summary class="operation-group-header">
        <div>
          <span class="group-icon">↳</span>

          <div>
            <strong>${folder}</strong>

            <span>
              ${operations.length.toLocaleString("pt-BR")}
              ${operations.length === 1
        ? "arquivo"
        : "arquivos"
      }
            </span>
          </div>
        </div>

        <span class="group-status ${groupConflicts > 0
        ? "conflict"
        : ""
      }">
          ${statusLabel}
        </span>
      </summary>

      <div class="operation-group-content">
        ${operations
        .map(
          (operation) => `
              <div class="file-operation ${operation.status === "conflict"
              ? "conflict"
              : ""
            }">
                <div class="file-operation-header">
                  <strong>
                    ${operation.status ===
              "conflict"
              ? "⚠️"
              : "✓"
            }
                    ${getFileName(
              operation.source ||
              "Arquivo"
            )}
                  </strong>

                  <span>
                    ${operation.status ===
              "conflict"
              ? "Conflito"
              : "Pronto"
            }
                  </span>
                </div>

                ${operation.status ===
              "conflict"
              ? `<p>${operation.reason}</p>`
              : ""
            }
              </div>
            `
        )
        .join("")}
      </div>
    `;

    operationsList.appendChild(group);
  }

  reviewSection.appendChild(
    operationsList
  );

  planEl.appendChild(
    reviewSection
  );

  const reviewButton =
    document.querySelector(
      "#review-plan-button"
    );

  reviewButton?.addEventListener(
    "click",
    () => {
      reviewSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  );

  const executeButton =
    document.querySelector<HTMLButtonElement>(
      "#execute-plan-button"
    );

  executeButton?.addEventListener(
    "click",
    async () => {
      if (!currentOrganizationPlan) {
        return;
      }

      const confirmed =
        window.confirm(
          `✨ O FileStru vai organizar ${currentOrganizationPlan.summary.files_to_move} arquivos e criar ${currentOrganizationPlan.summary.directories_to_create} pastas.\n\nNenhum arquivo será excluído.\n\nDeseja continuar?`
        );

      if (!confirmed) {
        return;
      }

      executeButton.disabled = true;
      executeButton.textContent =
        "⏳ Organizando...";

      try {
        const result =
          await invoke<ExecutionResult>(
            "execute_organization_plan",
            {
              plan:
                currentOrganizationPlan,
            }
          );

        console.log(
          "Resultado da execução:",
          result
        );

        if (result.failed > 0) {
          window.alert(
            `⚠️ Organização concluída com algumas falhas.\n\n` +
            `✅ Executadas: ${result.executed}\n` +
            `⏭️ Ignoradas: ${result.skipped}\n` +
            `❌ Falhas: ${result.failed}`
          );
        } else {
          window.alert(
            `✅ Organização concluída!\n\n` +
            `${result.executed} operações executadas com sucesso.`
          );
        }

        if (selectedDirectory) {
          selectedDirectoryScan =
            await invoke<ScanResult>(
              "scan_directory",
              {
                path:
                  selectedDirectory,
              }
            );

          renderWorkspace();
        }
      } catch (error) {
        console.error(
          "Erro ao executar organização:",
          error
        );

        window.alert(
          "❌ Não foi possível executar a organização dos arquivos."
        );
      } finally {
        executeButton.disabled =
          false;

        executeButton.textContent =
          "✨ Organizar arquivos";
      }
    }
  );
}

async function chooseDirectory(): Promise<void> {
  const selectedPath =
    await open({
      directory: true,
      multiple: false,
      title:
        "Escolha uma pasta para organizar",
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
      "#selected-directory"
    );

  if (selectedDirectoryEl) {
    selectedDirectoryEl.textContent =
      selectedPath;
  }

  const planEl =
    document.querySelector(
      "#organization-plan"
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
        }
      );
  } catch (error) {
    console.error(
      "Erro ao escanear pasta selecionada:",
      error
    );

    window.alert(
      "❌ Não foi possível carregar as informações da pasta selecionada."
    );

    return;
  }

  renderWorkspace();

  console.log(
    "Pasta selecionada:",
    selectedPath
  );
}

async function analyzeSelectedDirectory(): Promise<void> {
  if (!selectedDirectory) {
    window.alert(
      "📁 Escolha uma pasta antes de iniciar a análise."
    );

    return;
  }

  const analyzeButton =
    document.querySelector<HTMLButtonElement>(
      "#analyze-directory-button"
    );

  if (analyzeButton) {
    analyzeButton.disabled = true;
    analyzeButton.textContent =
      "🔎 Analisando...";
  }

  try {
    const organizationPlan =
      await invoke<OrganizationPlan>(
        "plan_directory_organization",
        {
          path:
            selectedDirectory,
        }
      );

    selectedDirectoryScan =
      await invoke<ScanResult>(
        "scan_directory",
        {
          path:
            selectedDirectory,
        }
      );

    renderOrganizationPlan(
      organizationPlan
    );
  } catch (error) {
    console.error(
      "Erro ao analisar diretório:",
      error
    );

    window.alert(
      "❌ Não foi possível analisar a pasta selecionada."
    );
  } finally {
    if (analyzeButton) {
      analyzeButton.disabled =
        false;

      analyzeButton.textContent =
        "🔎 Analisar pasta";
    }
  }
}

async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();

    if (!update) {
      window.alert("Você já está usando a versão mais recente do FileStru.");
      return;
    }

    const confirmed = window.confirm(
      `Uma nova versão do FileStru está disponível: ${update.version}\n\n` +
      `Versão atual: ${update.currentVersion}\n\n` +
      `${update.body || "Uma nova versão está disponível."}\n\n` +
      `Deseja instalar agora?`,
    );

    if (!confirmed) {
      await update.close();
      return;
    }

    await update.downloadAndInstall();
  } catch (error) {
    console.error("Erro ao verificar atualização:", error);
    window.alert(
      "Não foi possível verificar atualizações. Consulte o console para mais detalhes.",
    );
  }
}

window.addEventListener(
  "DOMContentLoaded",
  async () => {
    const chooseDirectoryButton =
      document.querySelector<HTMLButtonElement>(
        "#choose-directory-button"
      );

    chooseDirectoryButton?.addEventListener(
      "click",
      chooseDirectory
    );

    const analyzeDirectoryButton =
      document.querySelector<HTMLButtonElement>(
        "#analyze-directory-button"
      );

    const checkUpdatesButton =
      document.querySelector<HTMLButtonElement>("#check-updates-button");

    checkUpdatesButton?.addEventListener("click", checkForUpdates);

    analyzeDirectoryButton?.addEventListener(
      "click",
      analyzeSelectedDirectory
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
          }
        );

      const appStatusEl =
        document.querySelector(
          "#app-status"
        );

      if (appStatusEl) {
        appStatusEl.textContent =
          `🟢 ${appInfo as string} pronto`;
      }

      renderWorkspace();
    } catch (error) {
      console.error(
        "Erro ao carregar o FileStru:",
        error
      );

      const appStatusEl =
        document.querySelector(
          "#app-status"
        );

      if (appStatusEl) {
        appStatusEl.textContent =
          "❌ Não foi possível carregar o workspace.";
      }
    }
  }
);
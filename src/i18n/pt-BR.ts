import { en } from "./en";

export const ptBR = {
    ...en,

    // Workspace
    selectedFolder: "📂 Pasta selecionada",
    noFolderSelected: "Nenhuma pasta selecionada",
    chooseFolderDescription:
        "Escolha uma pasta acima para analisar e organizar seus arquivos.",
    trackedLocation: "📍 Local acompanhado",
    selectedLocation: "📂 Pasta selecionada",
    files: "arquivos",
    folders: "pastas",
    occupied: "ocupado",

    // Copy structure
    copyStructure: "📋 Copiar estrutura",
    copyStructureSuccess:
        "📋 Estrutura copiada para a área de transferência",
    structureCopied: "Estrutura copiada:",
    copyStructureError: "Erro ao copiar estrutura:",
    copyStructureFailed:
        "❌ Não foi possível copiar a estrutura para a área de transferência.",

    // Organization status
    analysisCompleted: "🔎 Análise concluída",
    everythingOrganized: "✅ Tudo organizado",
    selectedFolderStatus: "📁 Pasta selecionada",

    // Organization plan
    organizationSuggestion: "🧠 Sugestão de organização",
    organizationSuggestionTitle:
        "Encontramos uma forma de organizar esta pasta.",
    organizationSuggestionDescription:
        "O FileStru analisou os arquivos e preparou uma sugestão. Nenhum arquivo será alterado sem sua confirmação.",
    noChangesTitle: "Nenhuma alteração necessária.",
    noChangesDescription:
        "O FileStru analisou esta pasta e não encontrou arquivos que precisem ser reorganizados.",

    filesToOrganize: "arquivos para organizar",
    newFolders: "pastas novas",
    conflictsFound: "conflitos encontrados",

    summary: "📋 Resumo",
    howFilesWouldBeOrganized:
        "Como os arquivos seriam organizados",

    attentionItem: "item precisa",
    attentionItems: "itens precisam",
    attentionDescription:
        "Existem arquivos no destino que precisam ser avaliados antes de qualquer execução.",
    attention: "atenção",

    reviewOrganization: "🔎 Revisar organização",
    organizeFiles: "✨ Organizar arquivos",
    resolveConflicts:
        "⚠️ Resolva os conflitos antes de executar.",
    confirmationNotice:
        "🔒 Nenhum arquivo será alterado sem sua confirmação.",

    // Review
    details: "🔎 Detalhamento",
    proposedOperations: "Operações propostas",
    reviewDescription:
        "Confira cada alteração antes que qualquer arquivo seja modificado.",

    newFoldersLabel: "📁 Pastas novas",
    folderWillBeCreated: "pasta será criada",
    foldersWillBeCreated: "pastas serão criadas",

    ready: "✓ Pronto",
    conflict: "conflito",
    conflicts: "conflitos",
    file: "arquivo",
    fileLabel: "Arquivo",
    conflictTitle: "Conflito",
    readyTitle: "Pronto",

    // Execution
    organizing: "⏳ Organizando...",
    executionResult: "Resultado da execução:",
    executionError: "Erro ao executar organização:",
    executionFailed:
        "❌ Não foi possível executar a organização dos arquivos.",

    executionPartial:
        "⚠️ Organização concluída com algumas falhas.",
    executed: "✅ Executadas:",
    skipped: "⏭️ Ignoradas:",
    failed: "❌ Falhas:",
    executionSuccess: "✅ Organização concluída!",
    operationsExecuted:
        "operações executadas com sucesso.",

    confirmOrganization:
        "✨ O FileStru vai organizar {files} arquivos e criar {folders} pastas.\n\nNenhum arquivo será excluído.\n\nDeseja continuar?",

    // Folder selection / analysis
    chooseFolder: "Escolha uma pasta para organizar",
    chooseFolderFirst:
        "📁 Escolha uma pasta antes de iniciar a análise.",

    scanSelectedFolderError:
        "Erro ao escanear pasta selecionada:",
    loadWorkspaceFailed:
        "❌ Não foi possível carregar as informações da pasta selecionada.",

    selectedFolderLabel: "Pasta selecionada:",

    analyzing: "🔎 Analisando...",
    analyzeDirectoryError: "Erro ao analisar diretório:",
    analyzeFolderFailed:
        "❌ Não foi possível analisar a pasta selecionada.",
    analyzeFolder: "🔎 Analisar pasta",

    // App / updater
    latestVersion:
        "Você já está usando a versão mais recente do FileStru.",
    updateAvailable:
        "Uma nova versão do FileStru está disponível.",
    currentVersion: "Versão atual:",
    updateBodyFallback:
        "Uma nova versão está disponível.",
    installUpdate:
        "Deseja instalar agora?",
    updateCheckError: "Erro ao verificar atualização:",
    updateCheckFailed:
        "Não foi possível verificar atualizações. Consulte o console para mais detalhes.",

    appLoadError: "Erro ao carregar o FileStru:",
    workspaceLoadFailed:
        "❌ Não foi possível carregar o workspace.",
    appReady: "pronto",
} as const;
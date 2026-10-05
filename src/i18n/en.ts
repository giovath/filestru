export const en = {
    // Workspace
    selectedFolder: "📂 Selected folder",
    noFolderSelected: "No folder selected",
    chooseFolderDescription:
        "Choose a folder above to analyze and organize your files.",
    trackedLocation: "📍 Tracked location",
    selectedLocation: "📂 Selected folder",
    files: "files",
    folders: "folders",
    occupied: "used",

    // Copy structure
    copyStructure: "📋 Copy structure",
    copyStructureSuccess: "📋 Structure copied to clipboard",
    structureCopied: "Structure copied:",
    copyStructureError: "Error copying structure:",
    copyStructureFailed:
        "❌ Could not copy the structure to the clipboard.",

    // Organization status
    analysisCompleted: "🔎 Analysis completed",
    everythingOrganized: "✅ Everything is organized",
    selectedFolderStatus: "📁 Folder selected",

    // Organization plan
    organizationSuggestion: "🧠 Organization suggestion",
    organizationSuggestionTitle:
        "We found a way to organize this folder.",
    organizationSuggestionDescription:
        "FileStru analyzed the files and prepared a suggestion. No files will be changed without your confirmation.",
    noChangesTitle: "No changes needed.",
    noChangesDescription:
        "FileStru analyzed this folder and found no files that need to be reorganized.",

    filesToOrganize: "files to organize",
    newFolders: "new folders",
    conflictsFound: "conflicts found",

    summary: "📋 Summary",
    howFilesWouldBeOrganized: "How the files would be organized",

    attentionItem: "item needs",
    attentionItems: "items need",
    attentionDescription:
        "There are files at the destination that need to be reviewed before anything can be executed.",
    attention: "attention",

    reviewOrganization: "🔎 Review organization",
    organizeFiles: "✨ Organize files",
    resolveConflicts: "⚠️ Resolve conflicts before executing.",
    confirmationNotice:
        "🔒 No files will be changed without your confirmation.",

    // Review
    details: "🔎 Details",
    proposedOperations: "Proposed operations",
    reviewDescription:
        "Review each change before any file is modified.",

    newFoldersLabel: "📁 New folders",
    folderWillBeCreated: "folder will be created",
    foldersWillBeCreated: "folders will be created",

    ready: "✓ Ready",
    conflict: "conflict",
    conflicts: "conflicts",
    file: "file",
    fileLabel: "File",
    conflictTitle: "Conflict",
    readyTitle: "Ready",

    // Execution
    organizing: "⏳ Organizing...",
    executionResult: "Execution result:",
    executionError: "Error executing organization:",
    executionFailed:
        "❌ Could not organize the files.",

    executionPartial:
        "⚠️ Organization completed with some failures.",
    executed: "✅ Executed:",
    skipped: "⏭️ Skipped:",
    failed: "❌ Failed:",
    executionSuccess: "✅ Organization completed!",
    operationsExecuted:
        "operations executed successfully.",

    confirmOrganization:
        "✨ FileStru will organize {files} files and create {folders} folders.\n\nNo files will be deleted.\n\nDo you want to continue?",

    // Folder selection / analysis
    chooseFolder: "Choose a folder to organize",
    chooseFolderFirst:
        "📁 Choose a folder before starting the analysis.",

    scanSelectedFolderError:
        "Error scanning selected folder:",
    loadWorkspaceFailed:
        "❌ Could not load information about the selected folder.",

    selectedFolderLabel: "Selected folder:",

    analyzing: "🔎 Analyzing...",
    analyzeDirectoryError: "Error analyzing directory:",
    analyzeFolderFailed:
        "❌ Could not analyze the selected folder.",
    analyzeFolder: "🔎 Analyze folder",

    // App / updater
    latestVersion:
        "You are already using the latest version of FileStru.",
    updateAvailable:
        "A new version of FileStru is available.",
    currentVersion: "Current version:",
    updateBodyFallback:
        "A new version is available.",
    installUpdate:
        "Do you want to install it now?",
    updateCheckError:
        "Error checking for updates:",
    updateCheckFailed:
        "Could not check for updates. See the console for more details.",

    appLoadError: "Error loading FileStru:",
    workspaceLoadFailed:
        "❌ Could not load the workspace.",
    appReady: "ready",
} as const;
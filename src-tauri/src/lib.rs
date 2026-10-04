mod classification;
mod execution;
mod organization;

#[derive(serde::Serialize)]
pub(crate) struct FileSystemItem {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) kind: String,
    pub(crate) extension: Option<String>,
    pub(crate) size: u64,
    pub(crate) created_at: Option<String>,
    pub(crate) modified_at: Option<String>,
    pub(crate) parent_path: Option<String>,
}

#[derive(serde::Serialize)]
pub(crate) struct ScanResult {
    pub(crate) location: String,
    pub(crate) items: Vec<FileSystemItem>,
    pub(crate) total_files: u64,
    pub(crate) total_directories: u64,
    pub(crate) total_size: u64,
}

#[derive(serde::Serialize)]
pub(crate) struct WorkspaceScan {
    pub(crate) locations: Vec<ScanResult>,
}

#[tauri::command]
fn scan_directory(path: String) -> Result<ScanResult, String> {
    fn scan_entries(
        path: &std::path::Path,
        items: &mut Vec<FileSystemItem>,
        total_files: &mut u64,
        total_directories: &mut u64,
        total_size: &mut u64,
    ) {
        let entries = match std::fs::read_dir(path) {
            Ok(entries) => entries,
            Err(_) => return,
        };

        for entry in entries {
            let entry = match entry {
                Ok(entry) => entry,
                Err(_) => continue,
            };

            let entry_path = entry.path();

            let metadata = match entry.metadata() {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };

            let is_directory = metadata.is_dir();

            if is_directory {
                *total_directories += 1;
            } else {
                *total_files += 1;
                *total_size += metadata.len();
            }

            let name = entry.file_name().to_string_lossy().to_string();

            let extension = if metadata.is_file() {
                entry_path
                    .extension()
                    .map(|extension| extension.to_string_lossy().to_lowercase())
            } else {
                None
            };

            let parent_path = entry_path
                .parent()
                .map(|parent| parent.to_string_lossy().to_string());

            items.push(FileSystemItem {
                name,
                path: entry_path.to_string_lossy().to_string(),
                kind: if is_directory {
                    "directory".to_string()
                } else {
                    "file".to_string()
                },
                extension,
                size: metadata.len(),
                created_at: metadata.created().ok().map(|date| format!("{:?}", date)),
                modified_at: metadata.modified().ok().map(|date| format!("{:?}", date)),
                parent_path,
            });

            if is_directory {
                scan_entries(
                    &entry_path,
                    items,
                    total_files,
                    total_directories,
                    total_size,
                );
            }
        }
    }

    let root = std::path::Path::new(&path);

    if !root.exists() {
        return Err(format!("O diretório não existe: {}", path));
    }

    if !root.is_dir() {
        return Err(format!("O caminho não é um diretório: {}", path));
    }

    let mut items = Vec::new();
    let mut total_files = 0;
    let mut total_directories = 0;
    let mut total_size = 0;

    scan_entries(
        root,
        &mut items,
        &mut total_files,
        &mut total_directories,
        &mut total_size,
    );

    Ok(ScanResult {
        location: path,
        items,
        total_files,
        total_directories,
        total_size,
    })
}

#[tauri::command]
fn scan_workspace(paths: Vec<String>) -> Result<WorkspaceScan, String> {
    let mut locations = Vec::new();

    for path in paths {
        let scan = scan_directory(path)?;
        locations.push(scan);
    }

    Ok(WorkspaceScan { locations })
}

#[tauri::command]
fn plan_directory_organization(path: String) -> Result<organization::OrganizationPlan, String> {
    let scan = scan_directory(path)?;

    Ok(organization::build_type_based_plan(
        &scan.location,
        &scan.items,
    ))
}

#[tauri::command]
fn execute_organization_plan(
    plan: organization::OrganizationPlan,
) -> Result<execution::ExecutionResult, String> {
    Ok(execution::execute_plan(&plan))
}

#[tauri::command]
fn get_app_info() -> String {
    "FileStru".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            scan_directory,
            scan_workspace,
            plan_directory_organization,
            execute_organization_plan
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use std::collections::BTreeSet;
use std::path::Path;

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationType {
    CreateDirectory,
    Move,
    Rename,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationStatus {
    Ready,
    Conflict,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OrganizationOperation {
    pub operation_type: OperationType,
    pub status: OperationStatus,
    pub source: Option<String>,
    pub destination: String,
    pub reason: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OrganizationSummary {
    pub files_to_move: u64,
    pub files_to_rename: u64,
    pub directories_to_create: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OrganizationPlan {
    pub source: String,
    pub operations: Vec<OrganizationOperation>,
    pub summary: OrganizationSummary,
}

pub fn build_type_based_plan(source: &str, items: &[crate::FileSystemItem]) -> OrganizationPlan {
    let mut operations = Vec::new();
    let mut directories_to_create = BTreeSet::new();

    let existing_directories: BTreeSet<String> = items
        .iter()
        .filter(|item| item.kind == "directory")
        .map(|item| item.path.clone())
        .collect();

    let existing_paths: BTreeSet<String> = items.iter().map(|item| item.path.clone()).collect();

    for item in items {
        if item.kind != "file" {
            continue;
        }

        let Some(parent_path) = &item.parent_path else {
            continue;
        };

        if parent_path != source {
            continue;
        }

        let classification = crate::classification::classify_extension(item.extension.as_deref());

        let directory_name = match classification.category.as_str() {
            "document" => "Documentos",
            "spreadsheet" => "Planilhas",
            "presentation" => "Apresentações",
            "image" => "Imagens",
            "video" => "Vídeos",
            "audio" => "Áudios",
            "archive" => "Arquivos",
            "installer" => "Instaladores",
            "text" => "Textos",
            "data" => "Dados",
            _ => "Outros",
        };

        let source_directory_name = Path::new(source).file_name().and_then(|name| name.to_str());

        if source_directory_name == Some(directory_name) {
            continue;
        }

        let destination_directory = Path::new(source).join(directory_name);

        let destination_directory_string = destination_directory.to_string_lossy().to_string();

        if !existing_directories.contains(&destination_directory_string) {
            directories_to_create.insert(destination_directory_string.clone());
        }

        let destination = destination_directory.join(&item.name);
        let destination_string = destination.to_string_lossy().to_string();

        let has_conflict = existing_paths.contains(&destination_string);

        let status = if has_conflict {
            OperationStatus::Conflict
        } else {
            OperationStatus::Ready
        };

        let reason = if has_conflict {
            format!("Conflito: o destino já existe: {}", destination_string)
        } else {
            format!(
                "Arquivo classificado como {} pela extensão.",
                classification.category
            )
        };

        operations.push(OrganizationOperation {
            operation_type: OperationType::Move,
            status,
            source: Some(item.path.clone()),
            destination: destination_string,
            reason,
        });
    }

    let mut final_operations = Vec::new();

    for directory in &directories_to_create {
        final_operations.push(OrganizationOperation {
            operation_type: OperationType::CreateDirectory,
            status: OperationStatus::Ready,
            source: None,
            destination: directory.clone(),
            reason: "Pasta necessária para o agrupamento dos arquivos.".to_string(),
        });
    }

    final_operations.extend(operations);

    let files_to_move = final_operations
        .iter()
        .filter(|operation| operation.operation_type == OperationType::Move)
        .count() as u64;

    let directories_to_create_count = directories_to_create.len() as u64;

    OrganizationPlan {
        source: source.to_string(),
        operations: final_operations,
        summary: OrganizationSummary {
            files_to_move,
            files_to_rename: 0,
            directories_to_create: directories_to_create_count,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file_item(
        name: &str,
        path: &str,
        extension: Option<&str>,
        parent_path: &str,
    ) -> crate::FileSystemItem {
        crate::FileSystemItem {
            name: name.to_string(),
            path: path.to_string(),
            kind: "file".to_string(),
            extension: extension.map(|value| value.to_string()),
            size: 100,
            created_at: None,
            modified_at: None,
            parent_path: Some(parent_path.to_string()),
        }
    }

    fn directory_item(path: &str, parent_path: &str) -> crate::FileSystemItem {
        crate::FileSystemItem {
            name: Path::new(path)
                .file_name()
                .unwrap()
                .to_string_lossy()
                .to_string(),
            path: path.to_string(),
            kind: "directory".to_string(),
            extension: None,
            size: 0,
            created_at: None,
            modified_at: None,
            parent_path: Some(parent_path.to_string()),
        }
    }

    #[test]
    fn creates_valid_organization_plan() {
        let items = vec![file_item(
            "documento.pdf",
            "C:\\Downloads\\documento.pdf",
            Some("pdf"),
            "C:\\Downloads",
        )];

        let plan = build_type_based_plan("C:\\Downloads", &items);

        assert_eq!(plan.source, "C:\\Downloads");
        assert_eq!(plan.summary.files_to_move, 1);
        assert_eq!(plan.summary.directories_to_create, 1);
        assert_eq!(plan.operations.len(), 2);

        let move_operation = plan
            .operations
            .iter()
            .find(|operation| operation.operation_type == OperationType::Move)
            .unwrap();

        assert_eq!(move_operation.status, OperationStatus::Ready);

        assert_eq!(
            move_operation.destination,
            "C:\\Downloads\\Documentos\\documento.pdf"
        );
    }

    #[test]
    fn rename_operation_uses_source_and_destination() {
        let operation = OrganizationOperation {
            operation_type: OperationType::Rename,
            status: OperationStatus::Ready,
            source: Some("C:\\Downloads\\arquivo antigo.pdf".to_string()),
            destination: "C:\\Downloads\\arquivo novo.pdf".to_string(),
            reason: "Nome mais descritivo.".to_string(),
        };

        assert_eq!(
            operation.source,
            Some("C:\\Downloads\\arquivo antigo.pdf".to_string())
        );

        assert_eq!(operation.destination, "C:\\Downloads\\arquivo novo.pdf");
    }

    #[test]
    fn builds_type_based_plan_without_touching_existing_subfolders() {
        let items = vec![
            file_item(
                "documento-raiz.pdf",
                "C:\\Downloads\\documento-raiz.pdf",
                Some("pdf"),
                "C:\\Downloads",
            ),
            file_item(
                "documento-interno.pdf",
                "C:\\Downloads\\Projeto\\documento-interno.pdf",
                Some("pdf"),
                "C:\\Downloads\\Projeto",
            ),
            directory_item("C:\\Downloads\\Projeto", "C:\\Downloads"),
        ];

        let plan = build_type_based_plan("C:\\Downloads", &items);

        assert_eq!(plan.summary.files_to_move, 1);

        let move_operations: Vec<_> = plan
            .operations
            .iter()
            .filter(|operation| operation.operation_type == OperationType::Move)
            .collect();

        assert_eq!(move_operations.len(), 1);

        assert_eq!(
            move_operations[0].source,
            Some("C:\\Downloads\\documento-raiz.pdf".to_string())
        );
    }

    #[test]
    fn does_not_create_directory_when_destination_already_exists() {
        let items = vec![
            file_item(
                "documento.pdf",
                "C:\\Downloads\\documento.pdf",
                Some("pdf"),
                "C:\\Downloads",
            ),
            directory_item("C:\\Downloads\\Documentos", "C:\\Downloads"),
        ];

        let plan = build_type_based_plan("C:\\Downloads", &items);

        assert_eq!(plan.summary.directories_to_create, 0);
    }

    #[test]
    fn creates_directory_when_destination_does_not_exist() {
        let items = vec![file_item(
            "documento.pdf",
            "C:\\Downloads\\documento.pdf",
            Some("pdf"),
            "C:\\Downloads",
        )];

        let plan = build_type_based_plan("C:\\Downloads", &items);

        assert_eq!(plan.summary.directories_to_create, 1);

        let create_operation = plan
            .operations
            .iter()
            .find(|operation| operation.operation_type == OperationType::CreateDirectory)
            .unwrap();

        assert_eq!(create_operation.status, OperationStatus::Ready);
    }

    #[test]
    fn marks_move_as_conflict_when_destination_exists() {
        let items = vec![
            file_item(
                "documento.pdf",
                "C:\\Downloads\\documento.pdf",
                Some("pdf"),
                "C:\\Downloads",
            ),
            directory_item("C:\\Downloads\\Documentos", "C:\\Downloads"),
            file_item(
                "documento.pdf",
                "C:\\Downloads\\Documentos\\documento.pdf",
                Some("pdf"),
                "C:\\Downloads\\Documentos",
            ),
        ];

        let plan = build_type_based_plan("C:\\Downloads", &items);

        let move_operation = plan
            .operations
            .iter()
            .find(|operation| {
                operation.operation_type == OperationType::Move
                    && operation.source == Some("C:\\Downloads\\documento.pdf".to_string())
            })
            .unwrap();

        assert_eq!(move_operation.status, OperationStatus::Conflict);

        assert!(move_operation.reason.contains("Conflito"));
    }
    #[test]
    fn does_not_nest_category_directory_inside_itself() {
        let items = vec![file_item(
            "foto.jpg",
            "C:\\Downloads\\Imagens\\foto.jpg",
            Some("jpg"),
            "C:\\Downloads\\Imagens",
        )];

        let plan = build_type_based_plan("C:\\Downloads\\Imagens", &items);

        assert_eq!(plan.summary.files_to_move, 0);
        assert_eq!(plan.summary.directories_to_create, 0);
        assert!(plan.operations.is_empty());
    }
}

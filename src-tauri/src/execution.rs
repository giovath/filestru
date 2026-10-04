use crate::organization::{
    OperationStatus, OperationType, OrganizationOperation, OrganizationPlan,
};

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionStatus {
    Executed,
    Skipped,
    Failed,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct OperationExecutionResult {
    pub operation_type: OperationType,
    pub status: ExecutionStatus,
    pub source: Option<String>,
    pub destination: String,
    pub message: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ExecutionResult {
    pub total: u64,
    pub executed: u64,
    pub skipped: u64,
    pub failed: u64,
    pub operations: Vec<OperationExecutionResult>,
}

pub fn execute_plan(plan: &OrganizationPlan) -> ExecutionResult {
    let mut results = Vec::new();

    for operation in &plan.operations {
        let result = execute_operation(operation);
        results.push(result);
    }

    let total = results.len() as u64;

    let executed = results
        .iter()
        .filter(|result| result.status == ExecutionStatus::Executed)
        .count() as u64;

    let skipped = results
        .iter()
        .filter(|result| result.status == ExecutionStatus::Skipped)
        .count() as u64;

    let failed = results
        .iter()
        .filter(|result| result.status == ExecutionStatus::Failed)
        .count() as u64;

    ExecutionResult {
        total,
        executed,
        skipped,
        failed,
        operations: results,
    }
}

fn execute_operation(operation: &OrganizationOperation) -> OperationExecutionResult {
    if operation.status == OperationStatus::Conflict {
        return OperationExecutionResult {
            operation_type: operation.operation_type.clone(),
            status: ExecutionStatus::Skipped,
            source: operation.source.clone(),
            destination: operation.destination.clone(),
            message: "Operação ignorada porque o plano marcou o destino como conflito.".to_string(),
        };
    }

    match operation.operation_type {
        OperationType::CreateDirectory => execute_create_directory(operation),

        OperationType::Move => execute_move(operation),

        OperationType::Rename => execute_rename(operation),
    }
}

fn execute_create_directory(operation: &OrganizationOperation) -> OperationExecutionResult {
    let destination = std::path::Path::new(&operation.destination);

    if destination.exists() {
        if destination.is_dir() {
            return OperationExecutionResult {
                operation_type: operation.operation_type.clone(),
                status: ExecutionStatus::Executed,
                source: operation.source.clone(),
                destination: operation.destination.clone(),
                message: "A pasta já existia e está pronta para uso.".to_string(),
            };
        }

        return OperationExecutionResult {
            operation_type: operation.operation_type.clone(),
            status: ExecutionStatus::Failed,
            source: operation.source.clone(),
            destination: operation.destination.clone(),
            message: "O destino já existe, mas não é uma pasta.".to_string(),
        };
    }

    match std::fs::create_dir_all(destination) {
        Ok(_) => OperationExecutionResult {
            operation_type: operation.operation_type.clone(),
            status: ExecutionStatus::Executed,
            source: operation.source.clone(),
            destination: operation.destination.clone(),
            message: "Pasta criada com sucesso.".to_string(),
        },

        Err(error) => OperationExecutionResult {
            operation_type: operation.operation_type.clone(),
            status: ExecutionStatus::Failed,
            source: operation.source.clone(),
            destination: operation.destination.clone(),
            message: format!("Não foi possível criar a pasta: {}", error),
        },
    }
}

fn execute_move(operation: &OrganizationOperation) -> OperationExecutionResult {
    execute_filesystem_move(operation)
}

fn execute_rename(operation: &OrganizationOperation) -> OperationExecutionResult {
    execute_filesystem_move(operation)
}

fn execute_filesystem_move(operation: &OrganizationOperation) -> OperationExecutionResult {
    let Some(source) = &operation.source else {
        return OperationExecutionResult {
            operation_type: operation.operation_type.clone(),
            status: ExecutionStatus::Failed,
            source: None,
            destination: operation.destination.clone(),
            message: "A operação não possui um arquivo de origem.".to_string(),
        };
    };

    let source_path = std::path::Path::new(source);
    let destination_path = std::path::Path::new(&operation.destination);

    if !source_path.exists() {
        return OperationExecutionResult {
            operation_type: operation.operation_type.clone(),
            status: ExecutionStatus::Failed,
            source: Some(source.clone()),
            destination: operation.destination.clone(),
            message: "O arquivo de origem não existe mais.".to_string(),
        };
    }

    if destination_path.exists() {
        return OperationExecutionResult {
            operation_type: operation.operation_type.clone(),
            status: ExecutionStatus::Failed,
            source: Some(source.clone()),
            destination: operation.destination.clone(),
            message: "O destino passou a existir depois da criação do plano.".to_string(),
        };
    }

    match std::fs::rename(source_path, destination_path) {
        Ok(_) => OperationExecutionResult {
            operation_type: operation.operation_type.clone(),
            status: ExecutionStatus::Executed,
            source: Some(source.clone()),
            destination: operation.destination.clone(),
            message: "Arquivo movimentado com sucesso.".to_string(),
        },

        Err(error) => OperationExecutionResult {
            operation_type: operation.operation_type.clone(),
            status: ExecutionStatus::Failed,
            source: Some(source.clone()),
            destination: operation.destination.clone(),
            message: format!("Não foi possível movimentar o arquivo: {}", error),
        },
    }
}

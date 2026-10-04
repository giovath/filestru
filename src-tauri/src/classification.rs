#[derive(Debug, Clone, serde::Serialize)]
pub struct FileClassification {
    pub category: String,
    pub extension: Option<String>,
    pub source: String,
}

pub fn classify_extension(extension: Option<&str>) -> FileClassification {
    let normalized_extension = extension.map(|value| value.to_lowercase());

    let category = match normalized_extension.as_deref() {
        Some("pdf") | Some("doc") | Some("docx") | Some("odt") | Some("rtf") => "document",

        Some("xls") | Some("xlsx") | Some("ods") => "spreadsheet",

        Some("ppt") | Some("pptx") | Some("odp") => "presentation",

        Some("jpg") | Some("jpeg") | Some("png") | Some("gif") | Some("webp") | Some("bmp")
        | Some("svg") => "image",

        Some("mp4") | Some("mov") | Some("avi") | Some("mkv") | Some("webm") => "video",

        Some("mp3") | Some("wav") | Some("flac") | Some("ogg") | Some("m4a") => "audio",

        Some("zip") | Some("rar") | Some("7z") | Some("tar") | Some("gz") => "archive",

        Some("exe") | Some("msi") => "installer",

        Some("txt") | Some("md") | Some("log") => "text",

        Some("csv") | Some("json") | Some("xml") => "data",

        _ => "other",
    };

    FileClassification {
        category: category.to_string(),
        extension: normalized_extension,
        source: "extension".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_pdf_as_document() {
        let result = classify_extension(Some("pdf"));

        assert_eq!(result.category, "document");
        assert_eq!(result.extension, Some("pdf".to_string()));
        assert_eq!(result.source, "extension");
    }

    #[test]
    fn classifies_jpg_as_image() {
        let result = classify_extension(Some("JPG"));

        assert_eq!(result.category, "image");
        assert_eq!(result.extension, Some("jpg".to_string()));
    }

    #[test]
    fn classifies_unknown_extension_as_other() {
        let result = classify_extension(Some("abc123"));

        assert_eq!(result.category, "other");
        assert_eq!(result.extension, Some("abc123".to_string()));
    }

    #[test]
    fn classifies_missing_extension_as_other() {
        let result = classify_extension(None);

        assert_eq!(result.category, "other");
        assert_eq!(result.extension, None);
    }
}

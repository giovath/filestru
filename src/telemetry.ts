import { getVersion } from "@tauri-apps/api/app";

const INSTALLATION_ID_KEY =
    "filestru_installation_id";

const TELEMETRY_ENDPOINT =
    "https://filestru-telemetry.giovanni-schlichta.workers.dev/telemetry";

type TelemetryProperties = Record<
    string,
    string | number | boolean | null
>;

function getInstallationId(): string {
    const existingId =
        localStorage.getItem(
            INSTALLATION_ID_KEY,
        );

    if (existingId) {
        return existingId;
    }

    const newId = crypto.randomUUID();

    localStorage.setItem(
        INSTALLATION_ID_KEY,
        newId,
    );

    return newId;
}

export async function track(
    event: string,
    properties: TelemetryProperties = {},
): Promise<void> {
    try {
        const version = await getVersion();

        const payload = {
            event,
            installation_id: getInstallationId(),
            version,
            platform: "windows",
            timestamp: new Date().toISOString(),
            ...properties,
        };

        await fetch(
            TELEMETRY_ENDPOINT,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            },
        );

    } catch (error) {
        console.error(
            "[FileStru telemetry] failed",
            error,
        );
    }
}
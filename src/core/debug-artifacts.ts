export const sanitizeArtifactLabel = (label: string): string =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "artifact";

export const buildArtifactFileName = ({
  label,
  timestamp,
  extension
}: {
  label: string;
  timestamp: string;
  extension: string;
}): string => `${timestamp.replaceAll(":", "-")}-${sanitizeArtifactLabel(label)}.${extension}`;

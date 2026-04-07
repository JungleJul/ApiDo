"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildArtifactFileName = exports.sanitizeArtifactLabel = void 0;
const sanitizeArtifactLabel = (label) => label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "artifact";
exports.sanitizeArtifactLabel = sanitizeArtifactLabel;
const buildArtifactFileName = ({ label, timestamp, extension }) => `${timestamp.replaceAll(":", "-")}-${(0, exports.sanitizeArtifactLabel)(label)}.${extension}`;
exports.buildArtifactFileName = buildArtifactFileName;
//# sourceMappingURL=debug-artifacts.js.map
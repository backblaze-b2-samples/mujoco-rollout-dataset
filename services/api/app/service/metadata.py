"""On-demand metadata for a stored object (`GET /files-by-key/detail`).

This app produces its own rich metadata at rollout time — the per-episode
`summary.json` written to B2 — so post-hoc format extraction (image/EXIF/PDF via
Pillow/PyPDF2) was removed with the upload flow. What remains is the
format-agnostic core the full-bucket explorer's detail panel shows: exact
checksums, size, MIME type and extension, recomputed by re-reading the object.
The image/PDF/AV fields on `FileMetadataDetail` stay null.
"""

import hashlib
from datetime import UTC, datetime

from app.types import FileMetadataDetail
from app.types.formatting import humanize_bytes


def extract_metadata(
    file_data: bytes,
    filename: str,
    content_type: str,
    uploaded_at: datetime | None = None,
) -> FileMetadataDetail:
    """Compute format-agnostic metadata (checksums, size, type) from raw bytes.

    `uploaded_at` is the object's real upload time; callers recomputing metadata
    for an already-stored object MUST pass it (from head_object's LastModified)
    so the panel shows the true upload time rather than the recompute time. It
    defaults to now only for the fresh-object path, where the two coincide.
    """
    md5 = hashlib.md5(file_data, usedforsecurity=False).hexdigest()
    sha256 = hashlib.sha256(file_data).hexdigest()
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    return FileMetadataDetail(
        filename=filename,
        size_bytes=len(file_data),
        size_human=humanize_bytes(len(file_data)),
        mime_type=content_type,
        extension=extension,
        md5=md5,
        sha256=sha256,
        uploaded_at=uploaded_at if uploaded_at is not None else datetime.now(UTC),
    )

"""B2-backed persistence for rollouts and their episode artifacts.

Every object lives under the ``rollouts/`` prefix:

    rollouts/<id>/config.json
    rollouts/<id>/episodes/<episode_id>/video.mp4   (or frames.zip)
    rollouts/<id>/episodes/<episode_id>/state.npy
    rollouts/<id>/episodes/<episode_id>/action.npy
    rollouts/<id>/episodes/<episode_id>/reward.npy
    rollouts/<id>/episodes/<episode_id>/summary.json

B2 is the sole store — there is no database. boto3/botocore stays confined to
this ``repo`` layer (``tests/test_structure.py`` enforces it); the cached S3
client is reused from ``b2_client`` for connection pooling, so the custom
``user_agent_extra`` set there rides on every request made here too.
"""

import json

from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings
from app.repo.b2_client import get_presigned_url, get_s3_client
from app.repo.list_cache import invalidate as _invalidate_list_cache

ROLLOUT_PREFIX = "rollouts/"


def rollout_prefix(rollout_id: str) -> str:
    return f"{ROLLOUT_PREFIX}{rollout_id}/"


def config_key(rollout_id: str) -> str:
    return f"{ROLLOUT_PREFIX}{rollout_id}/config.json"


def episode_prefix(rollout_id: str, episode_id: str) -> str:
    return f"{ROLLOUT_PREFIX}{rollout_id}/episodes/{episode_id}/"


def put_bytes(key: str, data: bytes, content_type: str) -> None:
    """Write an object to B2. Raises RuntimeError on any S3 failure."""
    client = get_s3_client()
    try:
        client.put_object(
            Bucket=settings.b2_bucket_name,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
    except (ClientError, BotoCoreError) as e:
        raise RuntimeError(f"B2 put_object failed for '{key}': {e}") from e
    # New objects must show up in the full-bucket listing and dashboard stats now.
    _invalidate_list_cache()


def put_json(key: str, obj: dict) -> None:
    put_bytes(key, json.dumps(obj, indent=2).encode("utf-8"), "application/json")


def get_json(key: str) -> dict | None:
    """Read and parse a JSON object. Returns None if the key does not exist."""
    client = get_s3_client()
    try:
        response = client.get_object(Bucket=settings.b2_bucket_name, Key=key)
        return json.loads(response["Body"].read())
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey"):
            return None
        raise RuntimeError(f"B2 get_object failed for '{key}': {e}") from e
    except BotoCoreError as e:
        raise RuntimeError(f"B2 get_object failed for '{key}': {e}") from e


def _list_common_prefixes(prefix: str) -> list[str]:
    """Return the immediate child "folders" under `prefix` (Delimiter='/')."""
    client = get_s3_client()
    prefixes: list[str] = []
    kwargs: dict = {
        "Bucket": settings.b2_bucket_name,
        "Prefix": prefix,
        "Delimiter": "/",
        "MaxKeys": 1000,
    }
    try:
        while True:
            response = client.list_objects_v2(**kwargs)
            for cp in response.get("CommonPrefixes", []):
                prefixes.append(cp["Prefix"])
            if not response.get("IsTruncated"):
                break
            kwargs["ContinuationToken"] = response["NextContinuationToken"]
    except (ClientError, BotoCoreError) as e:
        raise RuntimeError(f"B2 list failed for '{prefix}': {e}") from e
    return prefixes


def list_rollout_ids() -> list[str]:
    """Every rollout id (the child folders directly under `rollouts/`)."""
    return [cp[len(ROLLOUT_PREFIX) : -1] for cp in _list_common_prefixes(ROLLOUT_PREFIX)]


def list_episode_ids(rollout_id: str) -> list[str]:
    """Every episode id under a rollout, in lexical order."""
    prefix = f"{ROLLOUT_PREFIX}{rollout_id}/episodes/"
    return sorted(cp[len(prefix) : -1] for cp in _list_common_prefixes(prefix))


def object_size(key: str) -> int | None:
    """Content length of an object, or None if it does not exist."""
    client = get_s3_client()
    try:
        response = client.head_object(Bucket=settings.b2_bucket_name, Key=key)
        return response["ContentLength"]
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey"):
            return None
        raise RuntimeError(f"B2 head_object failed for '{key}': {e}") from e


def object_exists(key: str) -> bool:
    return object_size(key) is not None


def _list_all_keys(prefix: str) -> list[str]:
    """Every object key under `prefix` (no delimiter — recurses)."""
    client = get_s3_client()
    keys: list[str] = []
    kwargs: dict = {"Bucket": settings.b2_bucket_name, "Prefix": prefix, "MaxKeys": 1000}
    try:
        while True:
            response = client.list_objects_v2(**kwargs)
            keys.extend(obj["Key"] for obj in response.get("Contents", []))
            if not response.get("IsTruncated"):
                break
            kwargs["ContinuationToken"] = response["NextContinuationToken"]
    except (ClientError, BotoCoreError) as e:
        raise RuntimeError(f"B2 list failed for '{prefix}': {e}") from e
    return keys


def delete_prefix(prefix: str) -> int:
    """Delete every object under `prefix` in batches. Returns the count deleted.

    Scoped delete: callers pass a single rollout's prefix, so this never touches
    another rollout's data or anything outside `rollouts/`.
    """
    client = get_s3_client()
    keys = _list_all_keys(prefix)
    deleted = 0
    try:
        for start in range(0, len(keys), 1000):
            batch = keys[start : start + 1000]
            client.delete_objects(
                Bucket=settings.b2_bucket_name,
                Delete={"Objects": [{"Key": k} for k in batch], "Quiet": True},
            )
            deleted += len(batch)
    except (ClientError, BotoCoreError) as e:
        raise RuntimeError(f"B2 delete failed for '{prefix}': {e}") from e
    if deleted:
        _invalidate_list_cache()
    return deleted


def presign_get(key: str, filename: str | None = None, disposition: str = "attachment") -> str | None:
    """Presigned GET for an artifact, or None if the object does not exist."""
    if not object_exists(key):
        return None
    return get_presigned_url(key, filename=filename, disposition=disposition)

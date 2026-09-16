"""Rollout lifecycle tests.

The B2 boundary (`app.repo.rollout_store`) is replaced with a dict-backed fake,
so these run hermetically with no network. The rollout *run* path is exercised
for the engine-unavailable case — the one that must persist a `failed` rollout
instead of 500ing on a host without the MuJoCo stack.
"""

import json

import pytest

from app.repo import rollout_store
from app.service import mujoco_engine
from app.service import rollout as rollout_service


@pytest.fixture
def store(monkeypatch):
    objects: dict[str, tuple[bytes, str]] = {}

    def put_bytes(key, data, content_type):
        objects[key] = (data, content_type)

    def put_json(key, obj):
        objects[key] = (json.dumps(obj).encode("utf-8"), "application/json")

    def get_json(key):
        entry = objects.get(key)
        return json.loads(entry[0]) if entry else None

    def list_rollout_ids():
        ids = set()
        for key in objects:
            if key.startswith("rollouts/") and key.endswith("/config.json"):
                ids.add(key[len("rollouts/") : -len("/config.json")])
        return sorted(ids)

    def list_episode_ids(rollout_id):
        prefix = f"rollouts/{rollout_id}/episodes/"
        eids = {key[len(prefix) :].split("/")[0] for key in objects if key.startswith(prefix)}
        return sorted(eids)

    def object_exists(key):
        return key in objects

    def object_size(key):
        return len(objects[key][0]) if key in objects else None

    def delete_prefix(prefix):
        keys = [key for key in objects if key.startswith(prefix)]
        for key in keys:
            del objects[key]
        return len(keys)

    def presign_get(key, filename=None, disposition="attachment"):
        return f"https://signed.example/{key}" if key in objects else None

    for name, fn in {
        "put_bytes": put_bytes,
        "put_json": put_json,
        "get_json": get_json,
        "list_rollout_ids": list_rollout_ids,
        "list_episode_ids": list_episode_ids,
        "object_exists": object_exists,
        "object_size": object_size,
        "delete_prefix": delete_prefix,
        "presign_get": presign_get,
    }.items():
        monkeypatch.setattr(rollout_store, name, fn)

    return objects


async def _create(client, name="demo", **overrides):
    payload = {"name": name, **overrides}
    resp = await client.post("/rollouts", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_create_defaults_to_small_preset(client, store):
    body = await _create(client, name="cartpole")
    assert body["environment"] == "CartpoleBalance"
    assert body["episode_count"] == 2
    assert body["resolution"] == "240p"
    assert body["policy"] == "random"
    assert body["status"] == "draft"
    assert body["key_prefix"] == f"rollouts/{body['id']}/"


@pytest.mark.asyncio
async def test_create_list_get_roundtrip(client, store):
    created = await _create(client, name="ant", environment="AntRun")

    listed = await client.get("/rollouts")
    assert listed.status_code == 200
    ids = [r["id"] for r in listed.json()["rollouts"]]
    assert created["id"] in ids

    detail = await client.get(f"/rollouts/{created['id']}")
    assert detail.status_code == 200
    assert detail.json()["rollout"]["environment"] == "AntRun"
    assert detail.json()["episodes"] == []


@pytest.mark.asyncio
async def test_get_missing_rollout_404(client, store):
    resp = await client.get("/rollouts/does-not-exist")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_edit_draft_then_blocked_when_complete(client, store):
    created = await _create(client, name="editme")
    rid = created["id"]

    ok = await client.patch(f"/rollouts/{rid}", json={"resolution": "480p"})
    assert ok.status_code == 200
    assert ok.json()["resolution"] == "480p"

    # Force the stored config to a non-editable status, then confirm the guard.
    config = json.loads(store[f"rollouts/{rid}/config.json"][0])
    config["status"] = "complete"
    store[f"rollouts/{rid}/config.json"] = (json.dumps(config).encode(), "application/json")

    blocked = await client.patch(f"/rollouts/{rid}", json={"resolution": "720p"})
    assert blocked.status_code == 409


@pytest.mark.asyncio
async def test_delete_is_scoped_to_prefix(client, store):
    keep = await _create(client, name="keep")
    drop = await _create(client, name="drop")
    # A stray artifact under the drop prefix to prove the scoped delete sweeps it.
    store[f"rollouts/{drop['id']}/episodes/ep-0000/video.mp4"] = (b"x", "video/mp4")

    resp = await client.delete(f"/rollouts/{drop['id']}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True
    assert resp.json()["objects_deleted"] == 2

    # The other rollout is untouched.
    assert f"rollouts/{keep['id']}/config.json" in store
    assert not any(k.startswith(f"rollouts/{drop['id']}/") for k in store)


@pytest.mark.asyncio
async def test_run_without_engine_persists_failed(client, store, monkeypatch):
    """The headline path degrades gracefully when the ML stack is absent.

    The POST must return 200 with status='failed' (never 500), and the rollout
    must be persisted as failed so the UI can show it.
    """
    created = await _create(client, name="run")
    rid = created["id"]

    def _no_engine(config, episode_count, seed):
        raise mujoco_engine.EngineUnavailableError("engine not installed")

    monkeypatch.setattr(rollout_service, "run_episodes", _no_engine)

    resp = await client.post(f"/rollouts/{rid}/run", json={})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "failed"
    assert "engine not installed" in body["message"]
    assert body["episodes"] == []

    persisted = json.loads(store[f"rollouts/{rid}/config.json"][0])
    assert persisted["status"] == "failed"


@pytest.mark.asyncio
async def test_run_writes_episode_artifacts(client, store, monkeypatch):
    """A successful run streams every episode's five artifacts to B2."""
    created = await _create(client, name="ok", episode_count=1)
    rid = created["id"]

    def _fake_episodes(config, episode_count, seed):
        return [
            mujoco_engine.EpisodeArtifacts(
                episode_id="ep-0000",
                total_reward=1.5,
                length=10,
                success=True,
                video_bytes=b"MP4",
                video_content_type="video/mp4",
                video_filename="video.mp4",
                state_npy=b"STATE",
                action_npy=b"ACTION",
                reward_npy=b"REWARD",
                summary={"total_reward": 1.5, "length": 10, "success": True},
            )
        ]

    monkeypatch.setattr(rollout_service, "run_episodes", _fake_episodes)

    resp = await client.post(f"/rollouts/{rid}/run", json={})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "complete"
    assert len(body["episodes"]) == 1
    assert body["episodes"][0]["video_url"].startswith("https://signed.example/")

    prefix = f"rollouts/{rid}/episodes/ep-0000/"
    for name in ("video.mp4", "state.npy", "action.npy", "reward.npy", "summary.json"):
        assert prefix + name in store

    persisted = json.loads(store[f"rollouts/{rid}/config.json"][0])
    assert persisted["status"] == "complete"
    assert persisted["episode_count_done"] == 1

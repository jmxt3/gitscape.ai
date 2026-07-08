from app.skillforge.cache import SkillCache
from app.skillforge.ingest import BUILDER_VERSION, cache_key, content_hash
from app.skillforge.models import Manifest, SkillPackage


def test_content_hash_stable_and_sensitive():
    assert content_hash("abc") == content_hash("abc")
    assert content_hash("abc") != content_hash("abd")
    assert len(content_hash("abc")) == 64  # sha-256 hex


def test_cache_key_includes_builder_version():
    key = cache_key("digest text")
    assert key.endswith(f":{BUILDER_VERSION}")
    assert content_hash("digest text") in key


def _pkg(name: str) -> SkillPackage:
    return SkillPackage(
        name=name,
        skill_md="# x",
        manifest=Manifest(
            name=name, display_name=name, description="d",
            builder_version=BUILDER_VERSION, digest_hash="h",
        ),
    )


def test_skill_cache_get_set_and_lru_eviction():
    cache = SkillCache(maxsize=2)
    cache.set("a", _pkg("a"))
    cache.set("b", _pkg("b"))
    assert cache.get("a").name == "a"  # touch a -> most recent
    cache.set("c", _pkg("c"))  # evicts least-recent (b)
    assert cache.get("b") is None
    assert cache.get("a").name == "a"
    assert cache.get("c").name == "c"

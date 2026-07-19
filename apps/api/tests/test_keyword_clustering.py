"""Unit tests for SR-02 K-Means clustering (no live APIs)."""

from __future__ import annotations

import numpy as np

from apps.api.services.keyword_clustering import choose_k, cluster_embeddings


def test_choose_k_minimum_three_for_enough_keywords():
    assert choose_k(20) >= 3
    assert choose_k(2) <= 2


def test_cluster_embeddings_produces_multiple_groups():
    # Three tight groups in embedding space.
    rng = np.random.default_rng(0)
    group_a = (rng.normal(loc=0.0, scale=0.05, size=(8, 8)) + np.array([0, 0, 0, 0, 0, 0, 0, 0])).tolist()
    group_b = (rng.normal(loc=0.0, scale=0.05, size=(8, 8)) + np.array([5, 0, 0, 0, 0, 0, 0, 0])).tolist()
    group_c = (rng.normal(loc=0.0, scale=0.05, size=(8, 8)) + np.array([0, 5, 0, 0, 0, 0, 0, 0])).tolist()
    embeddings = group_a + group_b + group_c

    assignments = cluster_embeddings(embeddings, random_state=0)
    assert len(assignments) >= 3
    covered = sorted(i for a in assignments for i in a.keyword_indices)
    assert covered == list(range(len(embeddings)))
    assert all(len(a.keyword_indices) >= 2 for a in assignments)


def test_cluster_embeddings_empty():
    assert cluster_embeddings([]) == []

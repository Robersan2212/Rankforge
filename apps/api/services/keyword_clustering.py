"""K-Means clustering + small-cluster merge for SR-02."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from sklearn.cluster import KMeans


@dataclass
class ClusterAssignment:
    label_index: int
    keyword_indices: list[int]


def choose_k(n_keywords: int) -> int:
    if n_keywords < 3:
        return max(1, n_keywords)
    return max(3, int(round(math.sqrt(n_keywords / 2))))


def _centroid(vectors: np.ndarray) -> np.ndarray:
    if len(vectors) == 0:
        return np.zeros(vectors.shape[1] if vectors.ndim == 2 else 0)
    return vectors.mean(axis=0)


def _merge_small_clusters(
    embeddings: np.ndarray,
    labels: np.ndarray,
    *,
    min_size: int = 2,
) -> np.ndarray:
    """Merge clusters with fewer than min_size keywords into the nearest cluster."""
    labels = labels.copy()
    unique = sorted(set(int(x) for x in labels))

    while True:
        sizes = {u: int(np.sum(labels == u)) for u in unique}
        small = [u for u, size in sizes.items() if size < min_size]
        if not small or len(unique) <= 1:
            break

        centroids = {
            u: _centroid(embeddings[labels == u]) for u in unique if sizes[u] > 0
        }
        for small_id in small:
            if small_id not in centroids:
                continue
            others = [u for u in unique if u != small_id and sizes.get(u, 0) >= 1]
            if not others:
                break
            distances = [
                (
                    u,
                    float(
                        np.linalg.norm(centroids[small_id] - centroids[u])
                    ),
                )
                for u in others
            ]
            distances.sort(key=lambda item: item[1])
            target = distances[0][0]
            labels[labels == small_id] = target
            unique = sorted(set(int(x) for x in labels))
            break

    # Remap labels to contiguous 0..k-1
    remapped = labels.copy()
    remaining = sorted(set(int(x) for x in labels))
    mapping = {old: new for new, old in enumerate(remaining)}
    for old, new in mapping.items():
        remapped[labels == old] = new
    return remapped


def cluster_embeddings(
    embeddings: list[list[float]],
    *,
    random_state: int = 42,
) -> list[ClusterAssignment]:
    """Return cluster assignments (keyword indices per cluster)."""
    n = len(embeddings)
    if n == 0:
        return []

    matrix = np.asarray(embeddings, dtype=float)
    k = min(choose_k(n), n)
    if k <= 1:
        return [ClusterAssignment(label_index=0, keyword_indices=list(range(n)))]

    model = KMeans(n_clusters=k, n_init=10, random_state=random_state)
    labels = model.fit_predict(matrix)
    labels = _merge_small_clusters(matrix, labels, min_size=2)

    clusters: dict[int, list[int]] = {}
    for index, label in enumerate(labels):
        clusters.setdefault(int(label), []).append(index)

    return [
        ClusterAssignment(label_index=label, keyword_indices=indices)
        for label, indices in sorted(clusters.items(), key=lambda item: item[0])
    ]

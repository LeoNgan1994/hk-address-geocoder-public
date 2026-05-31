/** ECC / benchmark distance tiers: ≤20m, ≤50m, ≤100m, >100m (first-match cumulative). */
const DISTANCE_TIERS = [
  { key: "WITHIN_20M", max: 20, labelZh: "20m 內" },
  { key: "WITHIN_50M", max: 50, labelZh: "50m 內" },
  { key: "WITHIN_100M", max: 100, labelZh: "100m 內" },
  { key: "OVER_100M", max: Infinity, labelZh: "100m 外" },
];

function bucketDistance(distanceM) {
  if (distanceM == null || !Number.isFinite(distanceM)) {
    return "NO_RESULT";
  }
  for (const tier of DISTANCE_TIERS) {
    if (distanceM <= tier.max) {
      return tier.key;
    }
  }
  return "OVER_100M";
}

function isOver100m(bucket) {
  return bucket === "OVER_100M";
}

function initBucketCounts() {
  const counts = Object.fromEntries(DISTANCE_TIERS.map((t) => [t.key, 0]));
  counts.NO_ECC_REF = 0;
  counts.NO_RESULT = 0;
  counts.ERROR = 0;
  return counts;
}

module.exports = {
  DISTANCE_TIERS,
  bucketDistance,
  isOver100m,
  initBucketCounts,
};
